import { sql } from "drizzle-orm";
import "server-only";

import type { Database } from "@/db";
import { nextAnalysisCodeSql } from "@/db/analysis-code";
import {
  ANALYSIS_TRANSITIONS,
  analysisAttachmentSchema,
  analysisCommentSchema,
  analysisCreateSchema,
  analysisSchema,
  analysisStatusSchema,
  canPerform,
  commentCreateBodySchema,
  engineerCreateSchema,
  engineerRoleSchema,
  engineerSchema,
  type Analysis,
  type AnalysisAction,
  type AnalysisAttachment,
  type AnalysisComment,
  type AnalysisStatus,
  type Engineer,
} from "@/schemas";

export type EngineeringDb = Pick<Database, "execute">;

export type TransitionResult =
  | { kind: "ok"; analysis: Analysis }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "invalid_state"; status: AnalysisStatus };

type AttachmentInput = {
  analysisId: string;
  uploadedBy?: string | null;
} & (
  | { documentId: string }
  | { fileName: string; url: string; contentType: string; size: number }
);

export async function createEngineer(
  db: EngineeringDb,
  input: { name: string; email: string; role: Engineer["role"] },
): Promise<Engineer> {
  const fields = engineerCreateSchema.parse(input);
  const result = await db.execute<Record<string, unknown>>(sql`
    INSERT INTO engineers (id, name, email, role)
    VALUES (
      gen_random_uuid(),
      ${fields.name},
      ${fields.email},
      ${fields.role}::engineer_role
    )
    RETURNING id, name, email, role, created_at AS "createdAt"
  `);
  return engineerSchema.parse(engineerFrom(row(result, "Engineer insert")));
}

export async function listEngineers(db: EngineeringDb): Promise<Engineer[]> {
  const result = await db.execute<Record<string, unknown>>(sql`
    SELECT id, name, email, role, created_at AS "createdAt"
    FROM engineers
    ORDER BY created_at ASC, id ASC
  `);
  return rows(result).map((entry) => engineerSchema.parse(engineerFrom(entry)));
}

export async function createAnalysis(
  db: EngineeringDb,
  input: {
    title: string;
    dueDate?: string;
    assigneeId?: string;
    createdBy?: string | null;
  },
): Promise<Analysis> {
  const fields = analysisCreateSchema.parse({
    title: input.title,
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
  });
  const status = fields.assigneeId === undefined ? "unassigned" : "assigned";
  const result = await db.execute<Record<string, unknown>>(sql`
    INSERT INTO engineering_analyses (
      id, code, title, status, assignee_id, due_date, created_by
    )
    VALUES (
      gen_random_uuid(),
      ${nextAnalysisCodeSql()},
      ${fields.title},
      ${status}::engineering_analysis_status,
      ${fields.assigneeId ?? null}::uuid,
      ${fields.dueDate ?? null}::date,
      ${input.createdBy ?? null}::uuid
    )
    RETURNING
      id,
      code,
      title,
      status,
      assignee_id AS "assigneeId",
      due_date AS "dueDate",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      approved_at AS "approvedAt",
      created_by AS "createdBy"
  `);
  return analysisSchema.parse(analysisFrom(row(result, "Analysis insert")));
}

export async function getAnalysis(
  db: EngineeringDb,
  id: string,
): Promise<Analysis | null> {
  const result = await db.execute<Record<string, unknown>>(sql`
    SELECT
      id,
      code,
      title,
      status,
      assignee_id AS "assigneeId",
      due_date AS "dueDate",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      approved_at AS "approvedAt",
      created_by AS "createdBy"
    FROM engineering_analyses
    WHERE id = ${id}::uuid
  `);
  const found = rows(result)[0];
  return found ? analysisSchema.parse(analysisFrom(found)) : null;
}

export async function listAnalyses(db: EngineeringDb): Promise<Analysis[]> {
  const result = await db.execute<Record<string, unknown>>(sql`
    SELECT
      id,
      code,
      title,
      status,
      assignee_id AS "assigneeId",
      due_date AS "dueDate",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      approved_at AS "approvedAt",
      created_by AS "createdBy"
    FROM engineering_analyses
    ORDER BY created_at DESC, id DESC
  `);
  return rows(result).map((entry) => analysisSchema.parse(analysisFrom(entry)));
}

/**
 * One guarded UPDATE. The row changes only when its status is still `from`
 * and the actor's stored role is allowed. A second statement classifies a miss.
 * Neon HTTP cannot open a transaction around the two statements.
 */
export async function transitionAnalysis(input: {
  db: EngineeringDb;
  analysisId: string;
  actorId: string;
  action: AnalysisAction;
  assigneeId?: string;
}): Promise<TransitionResult> {
  const transition = ANALYSIS_TRANSITIONS[input.action];
  const allowed = engineerRoleSchema.options.filter((role) =>
    canPerform(role, input.action),
  );
  const assigneeId = input.assigneeId ?? null;
  const updated = await input.db.execute<Record<string, unknown>>(sql`
    UPDATE engineering_analyses AS a
    SET
      status = ${transition.to}::engineering_analysis_status,
      assignee_id = CASE
        WHEN ${input.action} = 'assign' THEN ${assigneeId}::uuid
        ELSE a.assignee_id
      END,
      approved_at = CASE
        WHEN ${input.action} = 'approve' THEN now()
        ELSE a.approved_at
      END,
      updated_at = now()
    FROM engineers AS actor
    WHERE a.id = ${input.analysisId}::uuid
      AND actor.id = ${input.actorId}::uuid
      AND a.status = ${transition.from}::engineering_analysis_status
      AND actor.role::text IN (${sql.join(
        allowed.map((role) => sql`${role}`),
        sql`, `,
      )})
      AND (
        ${sql.raw(transition.assignedAnalyst ? "FALSE" : "TRUE")}
        OR a.assignee_id = actor.id
      )
      AND (
        ${input.action} <> 'assign'
        OR EXISTS (
          SELECT 1 FROM engineers AS next_assignee
          WHERE next_assignee.id = ${assigneeId}::uuid
        )
      )
    RETURNING
      a.id,
      a.code,
      a.title,
      a.status,
      a.assignee_id AS "assigneeId",
      a.due_date AS "dueDate",
      a.created_at AS "createdAt",
      a.updated_at AS "updatedAt",
      a.approved_at AS "approvedAt",
      a.created_by AS "createdBy"
  `);
  const written = rows(updated)[0];
  if (written) {
    return {
      kind: "ok",
      analysis: analysisSchema.parse(analysisFrom(written)),
    };
  }
  return classifyMiss(input.db, input, transition.from);
}

export async function addComment(
  db: EngineeringDb,
  input: { analysisId: string; authorId?: string | null; body: string },
): Promise<AnalysisComment | null> {
  const fields = commentCreateBodySchema.parse({ body: input.body });
  const result = await db.execute<Record<string, unknown>>(sql`
    INSERT INTO analysis_comments (id, analysis_id, author_id, body)
    SELECT gen_random_uuid(), a.id, ${input.authorId ?? null}::uuid, ${fields.body}
    FROM engineering_analyses AS a
    WHERE a.id = ${input.analysisId}::uuid
    RETURNING
      id,
      analysis_id AS "analysisId",
      author_id AS "authorId",
      body,
      created_at AS "createdAt"
  `);
  const found = rows(result)[0];
  return found ? analysisCommentSchema.parse(commentFrom(found)) : null;
}

export async function listComments(
  db: EngineeringDb,
  analysisId: string,
): Promise<AnalysisComment[]> {
  const result = await db.execute<Record<string, unknown>>(sql`
    SELECT
      id,
      analysis_id AS "analysisId",
      author_id AS "authorId",
      body,
      created_at AS "createdAt"
    FROM analysis_comments
    WHERE analysis_id = ${analysisId}::uuid
    ORDER BY created_at ASC, id ASC
  `);
  return rows(result).map((entry) =>
    analysisCommentSchema.parse(commentFrom(entry)),
  );
}

export async function addAttachment(
  db: EngineeringDb,
  input: AttachmentInput,
): Promise<AnalysisAttachment | null> {
  const documentId = "documentId" in input ? input.documentId : null;
  const fileName = "fileName" in input ? input.fileName : null;
  const url = "url" in input ? input.url : null;
  const contentType = "contentType" in input ? input.contentType : null;
  const size = "size" in input ? input.size : null;
  const result = await db.execute<Record<string, unknown>>(sql`
    INSERT INTO analysis_attachments (
      id, analysis_id, document_id, file_name, url, content_type, size, uploaded_by
    )
    SELECT
      gen_random_uuid(),
      a.id,
      ${documentId}::uuid,
      ${fileName},
      ${url},
      ${contentType},
      ${size},
      ${input.uploadedBy ?? null}::uuid
    FROM engineering_analyses AS a
    WHERE a.id = ${input.analysisId}::uuid
    RETURNING
      id,
      analysis_id AS "analysisId",
      document_id AS "documentId",
      file_name AS "fileName",
      url,
      content_type AS "contentType",
      size,
      uploaded_by AS "uploadedBy",
      created_at AS "createdAt"
  `);
  const found = rows(result)[0];
  return found ? analysisAttachmentSchema.parse(attachmentFrom(found)) : null;
}

export async function listAttachments(
  db: EngineeringDb,
  analysisId: string,
): Promise<AnalysisAttachment[]> {
  const result = await db.execute<Record<string, unknown>>(sql`
    SELECT
      id,
      analysis_id AS "analysisId",
      document_id AS "documentId",
      file_name AS "fileName",
      url,
      content_type AS "contentType",
      size,
      uploaded_by AS "uploadedBy",
      created_at AS "createdAt"
    FROM analysis_attachments
    WHERE analysis_id = ${analysisId}::uuid
    ORDER BY created_at ASC, id ASC
  `);
  return rows(result).map((entry) =>
    analysisAttachmentSchema.parse(attachmentFrom(entry)),
  );
}

async function classifyMiss(
  db: EngineeringDb,
  input: {
    analysisId: string;
    actorId: string;
    action: AnalysisAction;
    assigneeId?: string;
  },
  from: AnalysisStatus,
): Promise<TransitionResult> {
  const result = await db.execute<Record<string, unknown>>(sql`
    SELECT
      a.status::text AS status,
      a.assignee_id::text AS "assigneeId",
      actor.role::text AS role,
      next_assignee.id::text AS "nextAssigneeId"
    FROM engineering_analyses AS a
    LEFT JOIN engineers AS actor ON actor.id = ${input.actorId}::uuid
    LEFT JOIN engineers AS next_assignee
      ON next_assignee.id = ${input.assigneeId ?? null}::uuid
    WHERE a.id = ${input.analysisId}::uuid
  `);
  const found = rows(result)[0];
  if (!isRecord(found)) {
    return { kind: "not_found" };
  }
  const status = analysisStatusSchema.parse(found.status);
  if (typeof found.role !== "string") {
    return { kind: "forbidden" };
  }
  const role = engineerRoleSchema.parse(found.role);
  if (status !== from) {
    return { kind: "invalid_state", status };
  }
  if (!canPerform(role, input.action)) {
    return { kind: "forbidden" };
  }
  const transition = ANALYSIS_TRANSITIONS[input.action];
  if (transition.assignedAnalyst && found.assigneeId !== input.actorId) {
    return { kind: "forbidden" };
  }
  if (transition.requiresAssignee && typeof found.nextAssigneeId !== "string") {
    return { kind: "not_found" };
  }
  return { kind: "invalid_state", status };
}

function analysisFrom(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    status: row.status,
    assigneeId: row.assigneeId ?? null,
    dueDate: asDay(row.dueDate),
    createdAt: asTimestamp(row.createdAt),
    updatedAt: asTimestamp(row.updatedAt),
    approvedAt: row.approvedAt == null ? null : asTimestamp(row.approvedAt),
    createdBy: row.createdBy ?? null,
  };
}

function engineerFrom(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: asTimestamp(row.createdAt),
  };
}

function commentFrom(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    analysisId: row.analysisId,
    authorId: row.authorId ?? null,
    body: row.body,
    createdAt: asTimestamp(row.createdAt),
  };
}

function attachmentFrom(row: Record<string, unknown>): Record<string, unknown> {
  const shared = {
    id: row.id,
    analysisId: row.analysisId,
    uploadedBy: row.uploadedBy ?? null,
    createdAt: asTimestamp(row.createdAt),
  };
  if (typeof row.documentId === "string") {
    return { ...shared, documentId: row.documentId };
  }
  return {
    ...shared,
    fileName: row.fileName,
    url: row.url,
    contentType: row.contentType,
    size: typeof row.size === "string" ? Number(row.size) : row.size,
  };
}

function asTimestamp(value: unknown): string {
  const instant = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(instant.getTime())) {
    throw new Error("Timestamp is invalid.");
  }
  return instant.toISOString();
}

function asDay(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

function row(result: unknown, label: string): Record<string, unknown> {
  const found = rows(result)[0];
  if (!found) {
    throw new Error(`${label} returned no row.`);
  }
  return found;
}

function rows(result: unknown): Record<string, unknown>[] {
  const list = Array.isArray(result)
    ? result
    : isRecord(result) && Array.isArray(result.rows)
      ? result.rows
      : null;
  if (!list) {
    throw new Error("Query did not return rows.");
  }
  return list.filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

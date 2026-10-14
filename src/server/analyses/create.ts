import "server-only";

import type { StoredAnalysis } from "@/features/analyses/stored";
import { createAnalysis } from "@/features/analyses/write";
import {
  createAnalysisResultSchema,
  idSchema,
  type AnalysisCreateBody,
  type AnalysisStatus,
  type CreateAnalysisResult,
} from "@/schemas";
import { detailsFromZod } from "@/server/documents/errors";
import { FindingRequestError } from "@/server/findings/errors";

/**
 * The repair-scoped writer still inserts one margin case. The public create
 * body does not carry a margin, so this route stores zero until that writer
 * follows the standalone analysis contract.
 */
const STORED_MARGIN_STUB = 0;

const STORED_STATUS = {
  draft: "unassigned",
  in_progress: "in_progress",
  in_review: "in_review",
  changes_requested: "waiting_for_review",
  approved: "approved",
} as const satisfies Record<StoredAnalysis["status"], AnalysisStatus>;

export const ANALYSIS_NOT_FOUND_MESSAGE = "That repair was not found.";

type Create = typeof createAnalysis;

export async function createRepairAnalysis(
  input: {
    orgId: string;
    repairId: string;
    fields: AnalysisCreateBody;
    actorId: unknown;
  },
  dependencies: { createAnalysis?: Create } = {},
): Promise<CreateAnalysisResult> {
  const repairId = requireUuid(input.repairId, "id");
  const fields = input.fields;
  const actorId = requireActorId(input.actorId);
  const create = dependencies.createAnalysis ?? createAnalysis;
  const result = await create({
    orgId: input.orgId,
    repairId,
    actorId,
    title: fields.title,
    margin: STORED_MARGIN_STUB,
    ...(fields.dueDate !== undefined ? { dueDate: fields.dueDate } : {}),
  });

  if (result.kind === "not_found") {
    throw new FindingRequestError("not_found", ANALYSIS_NOT_FOUND_MESSAGE);
  }
  return analysisRecord(result.analysis);
}

function analysisRecord(row: StoredAnalysis): CreateAnalysisResult {
  const status = STORED_STATUS[row.status];
  return createAnalysisResultSchema.parse({
    id: row.id,
    code: row.code,
    title: row.title,
    status,
    assigneeId: null,
    dueDate: row.dueDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    approvedAt: status === "approved" ? row.updatedAt : null,
    createdBy: row.createdBy,
  });
}

function requireActorId(actorId: unknown): string | null {
  if (actorId === null) {
    return null;
  }
  const parsed = idSchema.safeParse(actorId);
  if (!parsed.success) {
    throw new FindingRequestError(
      "validation_error",
      "actorId must be a UUID.",
      [
        {
          path: "actorId",
          message: "actorId must be a UUID.",
        },
      ],
    );
  }
  return parsed.data;
}

function requireUuid(value: string, path: string): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) {
    throw new FindingRequestError(
      "validation_error",
      `${path} must be a UUID.`,
      [
        {
          path,
          message: detailsFromZod(parsed.error)[0]?.message ?? "Invalid id",
        },
      ],
    );
  }
  return parsed.data;
}

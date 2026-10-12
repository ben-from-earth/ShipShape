import "server-only";

import { createAnalysis } from "@/features/analyses/write";
import {
  createAnalysisResultSchema,
  idSchema,
  type AnalysisCreateBody,
  type CreateAnalysisResult,
} from "@/schemas";
import { detailsFromZod } from "@/server/documents/errors";
import { FindingRequestError } from "@/server/findings/errors";

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
    margin: fields.margin,
    ...(fields.method !== undefined ? { method: fields.method } : {}),
    ...(fields.loadCase !== undefined ? { loadCase: fields.loadCase } : {}),
    ...(fields.status !== undefined ? { status: fields.status } : {}),
    ...(fields.dueDate !== undefined ? { dueDate: fields.dueDate } : {}),
    ...(fields.revision !== undefined ? { revision: fields.revision } : {}),
  });

  if (result.kind === "not_found") {
    throw new FindingRequestError("not_found", ANALYSIS_NOT_FOUND_MESSAGE);
  }
  return createAnalysisResultSchema.parse(result.analysis);
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

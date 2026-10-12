import "server-only";

import { createAnalysis } from "@/features/analyses/write";
import {
  analysisCreateSchema,
  createAnalysisResultSchema,
  idSchema,
  type CreateAnalysisResult,
} from "@/schemas";
import { detailsFromZod } from "@/server/documents/errors";
import { FindingRequestError } from "@/server/findings/errors";

export const ANALYSIS_NOT_FOUND_MESSAGE = "That repair was not found.";

const analysisBodySchema = analysisCreateSchema.omit({ repairId: true });

type Create = typeof createAnalysis;
type AnalysisBody = ReturnType<typeof analysisBodySchema.parse>;

export async function createRepairAnalysis(
  input: {
    orgId: string;
    repairId: string;
    body: unknown;
    actorId: unknown;
  },
  dependencies: { createAnalysis?: Create } = {},
): Promise<CreateAnalysisResult> {
  const repairId = requireUuid(input.repairId, "id");
  const fields = requireFields(input.body);
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

function requireFields(body: unknown): AnalysisBody {
  const parsed = analysisBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new FindingRequestError(
      "validation_error",
      "Analysis fields are invalid.",
      detailsFromZod(parsed.error).map((detail) => ({
        path: detail.path || "body",
        message: detail.message,
      })),
    );
  }
  return parsed.data;
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

import "server-only";

import { advanceStage } from "@/features/findings/advance-stage";
import {
  advanceFindingStageFieldsSchema,
  advanceFindingStageResultSchema,
  idSchema,
  type AdvanceFindingStageResult,
  type FindingStage,
} from "@/schemas";
import { detailsFromZod } from "@/server/documents/errors";

import { FindingRequestError } from "./errors";

export const FINDING_STAGE_NOT_FOUND_MESSAGE = "That finding was not found.";
export const FINDING_STAGE_INVALID_MESSAGE =
  "That stage change is not allowed.";
export const FINDING_STAGE_CONFLICT_MESSAGE =
  "The finding stage changed. Retry the request.";

type Advance = typeof advanceStage;

export async function changeFindingStage(
  input: {
    orgId: string;
    findingId: string;
    body: unknown;
    actorId: unknown;
  },
  dependencies: { advanceStage?: Advance } = {},
): Promise<AdvanceFindingStageResult> {
  const findingId = requireUuid(input.findingId, "id");
  const toStage = requireStage(input.body);
  const actorId = requireActorId(input.actorId);
  const advance = dependencies.advanceStage ?? advanceStage;
  const result = await advance({
    orgId: input.orgId,
    findingId,
    toStage,
    actorId,
  });

  switch (result.kind) {
    case "ok":
      return advanceFindingStageResultSchema.parse({
        id: result.transition.issueId,
        stage: result.stage,
        transitionedAt: result.transition.changedAt,
      });
    case "not_found":
      throw new FindingRequestError(
        "not_found",
        FINDING_STAGE_NOT_FOUND_MESSAGE,
      );
    case "invalid_transition":
      throw new FindingRequestError(
        "invalid_transition",
        FINDING_STAGE_INVALID_MESSAGE,
      );
    case "conflict":
      throw new FindingRequestError("conflict", FINDING_STAGE_CONFLICT_MESSAGE);
  }
}

function requireStage(body: unknown): FindingStage {
  const parsed = advanceFindingStageFieldsSchema.safeParse(body);
  if (!parsed.success) {
    throw new FindingRequestError(
      "validation_error",
      "toStage must be a work stage.",
      detailsFromZod(parsed.error).map((detail) => ({
        path: detail.path || "toStage",
        message: detail.message,
      })),
    );
  }
  return parsed.data.toStage;
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

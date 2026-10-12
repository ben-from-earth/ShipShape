import "server-only";

import { createRepair } from "@/features/repairs/data";
import {
  createRepairFieldsSchema,
  createRepairResultSchema,
  idSchema,
  type CreateRepairFields,
  type CreateRepairResult,
} from "@/schemas";
import { detailsFromZod } from "@/server/documents/errors";
import { FindingRequestError } from "@/server/findings/errors";

export const REPAIR_NOT_FOUND_MESSAGE = "That finding was not found.";

type Create = typeof createRepair;

export async function createFindingRepair(
  input: {
    orgId: string;
    findingId: string;
    body: unknown;
    actorId: unknown;
  },
  dependencies: { createRepair?: Create } = {},
): Promise<CreateRepairResult> {
  const findingId = requireUuid(input.findingId, "id");
  const fields = requireFields(input.body);
  const actorId = requireActorId(input.actorId);
  const create = dependencies.createRepair ?? createRepair;
  const result = await create({
    orgId: input.orgId,
    findingId,
    actorId,
    title: fields.title,
    ...(fields.type !== undefined ? { type: fields.type } : {}),
    ...(fields.status !== undefined ? { status: fields.status } : {}),
  });

  if (result.kind === "not_found") {
    throw new FindingRequestError("not_found", REPAIR_NOT_FOUND_MESSAGE);
  }
  return createRepairResultSchema.parse(result.repair);
}

function requireFields(body: unknown): CreateRepairFields {
  const parsed = createRepairFieldsSchema.safeParse(body);
  if (!parsed.success) {
    throw new FindingRequestError(
      "validation_error",
      "Repair fields are invalid.",
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

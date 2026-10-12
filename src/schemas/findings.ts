import { z } from "zod";

import {
  FINDING_PHOTO_STORED_MEDIA_TYPES,
  FINDING_SEVERITIES,
  MAX_FINDING_CAPTION_LENGTH,
  MAX_FINDING_CODE_LENGTH,
  MAX_FINDING_DESCRIPTION_LENGTH,
  MAX_FINDING_LOCATION_JSON_LENGTH,
  MAX_FINDING_LOCATION_LABEL_LENGTH,
  MAX_FINDING_PHOTOS,
  MAX_FINDING_ZONE_LENGTH,
  MIN_FINDING_PHOTOS,
} from "@/config/findings";

import { idSchema, timestampSchema } from "./common";

/**
 * `ObjectStorage` rejects a longer key. Same cap as `documentSchema`.
 */
const STORAGE_KEY_MAX_LENGTH = 500;

/**
 * Values of the `work_stage` enum in src/db/schema.ts.
 * A finding created by this contract is always `discovered`.
 */
export const findingStageSchema = z.enum([
  "discovered",
  "repair_defined",
  "analysis",
  "review",
  "approved",
  "closed",
]);

/**
 * JSON object stored in `issues.location`. The shape depends on the asset
 * type, so only the container is fixed: a JSON object, not an array,
 * string, or number. Values may be nested.
 */
export const findingLocationSchema = z.record(z.string(), z.json());

/** Required on create. Values are `FINDING_SEVERITIES` in src/config/findings.ts. */
export const findingSeveritySchema = z.enum(FINDING_SEVERITIES);

/**
 * Multipart text fields for POST /api/findings. Names match the intake
 * form where `issues` already has a column: `assetId`, `description`,
 * `zone`, and `locationLabel` (the form's location text). `severity` is
 * required too. `issues` has no severity column yet; Database Manager
 * adds a Postgres enum that matches `FINDING_SEVERITIES` in the sequence
 * migration. The server assigns id, stage, createdAt, and updatedAt.
 * Photos travel in the repeated `photos` file field and are not part of
 * this object.
 *
 * Notes are not a field. Description is the write-up.
 *
 * The asset group is not a field. The handler derives `assets.group_id`
 * from `assetId`. `groupId`, `assetGroup`, and `assetGroupId` are rejected.
 *
 * `code` is not a field. `issues.code` is the text form of `nextval` on a
 * Postgres sequence, added in a separate migration. The handler does not
 * accept a client code and does not use `MAX(code) + 1`.
 *
 * `issues` has no title or summary column. Those keys are rejected. A
 * short title (what `damageReportCreateSchema` calls `summary`) would
 * need a new column such as `issues.summary` and a migration.
 */
export const createFindingFieldsSchema = z.strictObject({
  assetId: trimmed(idSchema),
  description: z.string().trim().min(1).max(MAX_FINDING_DESCRIPTION_LENGTH),
  severity: findingSeveritySchema,
  zone: optionalText(MAX_FINDING_ZONE_LENGTH),
  locationLabel: optionalText(MAX_FINDING_LOCATION_LABEL_LENGTH),
  location: optionalLocation(),
  reportedBy: optionalUuid(),
  discoveredAt: optionalTimestamp(),
});

/**
 * One `issue_media` row. Every key is a column that already exists.
 * This contract does not add a file name, byte length, or other column.
 *
 * `storageKey` is the key `ObjectStorage.put` returns, not a path the
 * client chooses. `caption` is null when the create request did not send
 * one. `uploadedBy` is null until requests carry a session.
 */
export const findingPhotoSchema = z.strictObject({
  id: idSchema,
  issueId: idSchema,
  storageKey: z.string().trim().min(1).max(STORAGE_KEY_MAX_LENGTH),
  mimeType: z.enum(FINDING_PHOTO_STORED_MEDIA_TYPES),
  caption: z.string().trim().min(1).max(MAX_FINDING_CAPTION_LENGTH).nullable(),
  uploadedBy: idSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

/**
 * The `stage_transitions` row written with the issue. The first transition
 * has a null `from_stage`. `toStage` is `discovered`, which is why the 201
 * body reports that stage. Not part of the request or the 201 body.
 */
export const initialFindingStageTransitionSchema = z.object({
  id: idSchema,
  issueId: idSchema,
  fromStage: z.null(),
  toStage: z.literal("discovered"),
  changedBy: idSchema.nullable(),
  changedAt: timestampSchema,
});

/**
 * Body of the 201 response from POST /api/findings.
 *
 * `code` is the text stored from `nextval`. The client cannot send it.
 * `stage` is `discovered` because the same `db.batch` inserts the issue,
 * its `issue_media` rows, and the initial `stage_transitions` row.
 */
export const createFindingResultSchema = z.object({
  id: idSchema,
  code: z.string().trim().min(1).max(MAX_FINDING_CODE_LENGTH),
  stage: z.literal("discovered"),
  severity: findingSeveritySchema,
  createdAt: timestampSchema,
  photos: z
    .array(findingPhotoSchema)
    .min(MIN_FINDING_PHOTOS)
    .max(MAX_FINDING_PHOTOS),
});

export type FindingStage = z.infer<typeof findingStageSchema>;
export type FindingSeverity = z.infer<typeof findingSeveritySchema>;
export type FindingLocation = z.infer<typeof findingLocationSchema>;
export type CreateFindingFields = z.infer<typeof createFindingFieldsSchema>;
export type FindingPhoto = z.infer<typeof findingPhotoSchema>;
export type InitialFindingStageTransition = z.infer<
  typeof initialFindingStageTransitionSchema
>;
export type CreateFindingResult = z.infer<typeof createFindingResultSchema>;

function trimmed<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    schema,
  );
}

/** A missing or blank form field is omitted. A non-blank value is trimmed. */
function optionalText(maxLength: number) {
  return z.preprocess(
    blankToUndefined,
    z.string().min(1).max(maxLength).optional(),
  );
}

function optionalUuid() {
  return z.preprocess(blankToUndefined, idSchema.optional());
}

function optionalTimestamp() {
  return z.preprocess(blankToUndefined, timestampSchema.optional());
}

/**
 * `location` is a multipart text field. A JSON object string is parsed.
 * An object is accepted too, for a handler that parsed it already.
 * Blank is omitted, and the server stores `{}`.
 */
function optionalLocation() {
  return z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) {
        return undefined;
      }

      let candidate: unknown = value;
      if (typeof value === "string") {
        const trimmedValue = value.trim();
        if (trimmedValue.length === 0) {
          return undefined;
        }
        if (trimmedValue.length > MAX_FINDING_LOCATION_JSON_LENGTH) {
          ctx.addIssue({
            code: "custom",
            message: `location must be at most ${MAX_FINDING_LOCATION_JSON_LENGTH} characters`,
          });
          return z.NEVER;
        }
        try {
          candidate = JSON.parse(trimmedValue) as unknown;
        } catch {
          ctx.addIssue({
            code: "custom",
            message: "location must be a JSON object",
          });
          return z.NEVER;
        }
      }

      const parsed = findingLocationSchema.safeParse(candidate);
      if (!parsed.success) {
        ctx.addIssue({
          code: "custom",
          message: "location must be a JSON object",
        });
        return z.NEVER;
      }
      return parsed.data;
    });
}

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? undefined : trimmedValue;
}

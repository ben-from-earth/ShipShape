import { z } from "zod";

import {
  FINDING_PHOTO_STORED_MEDIA_TYPES,
  MAX_FINDING_CAPTION_LENGTH,
  MAX_FINDING_CODE_LENGTH,
  MAX_FINDING_DESCRIPTION_LENGTH,
  MAX_FINDING_LOCATION_JSON_LENGTH,
  MAX_FINDING_LOCATION_LABEL_LENGTH,
  MAX_FINDING_PHOTOS,
  MAX_FINDING_ZONE_LENGTH,
  MIN_FINDING_PHOTOS,
} from "@/config/findings";
import { SEVERITIES } from "@/config/severity";

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

/** Required on create. Labels are `SEVERITIES` in src/config/severity.ts. */
export const findingSeveritySchema = z.enum(SEVERITIES);

/**
 * Multipart text fields for POST /api/findings. Names match the intake
 * form where `issues` already has a column: `assetId`, `description`,
 * `zone`, and `locationLabel` (the form's location text). `severity` is
 * required and uses `SEVERITIES` from `src/config/severity.ts`, the same
 * list as the `issue_severity` enum on `issues.severity`. The server
 * assigns id, stage, createdAt, and updatedAt.
 * Photos travel in the repeated `photos` file field and are not part of
 * this object.
 *
 * Notes are not a field. Description is the write-up.
 *
 * The asset group is not a field. The handler derives `assets.group_id`
 * from `assetId`. `groupId`, `assetGroup`, and `assetGroupId` are rejected.
 *
 * `code` is not a field. The handler sets `issues.code` with
 * `nextIssueCodeSql()` inside the insert batch. It does not accept a
 * client code and does not use `MAX(code) + 1`.
 *
 * `issues` has no title or summary column. Those keys are rejected. A
 * short title would need a new column such as `issues.summary` and a
 * migration.
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
 * `code` is the text from `nextIssueCodeSql()`. The client cannot send it.
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

/**
 * Optional filters for `listFindings`. `stage` is `findingStageSchema`.
 * `severity` is `findingSeveritySchema` (`z.enum(SEVERITIES)`).
 */
export const findingListFiltersSchema = z.strictObject({
  stage: findingStageSchema.optional(),
  severity: findingSeveritySchema.optional(),
  assetId: idSchema.optional(),
});

/** Asset group named on a finding's asset. Null when the asset has none in this org. */
export const findingAssetGroupSummarySchema = z.strictObject({
  id: idSchema,
  name: z.string(),
});

/**
 * Asset the finding belongs to. `id` is `issues.asset_id`.
 * `assetGroup` is null when `assets.group_id` is null, or when that
 * group belongs to another organization.
 */
export const findingAssetSummarySchema = z.strictObject({
  id: idSchema,
  identifier: z.string(),
  name: z.string().nullable(),
  assetGroup: findingAssetGroupSummarySchema.nullable(),
});

/**
 * Photo metadata on a finding record. `mediaId` is `issue_media.id` (the
 * `id` on `findingPhotoSchema`). `contentType` is `issue_media.mime_type`
 * (`findingPhotoSchema`'s `mimeType`). `issue_media` has no byte-length
 * column, so `size` is null. The storage key stays off this object:
 * pages and client components read finding records, and the key is only
 * returned by `getFindingMedia`. No public URL and no bytes.
 */
export const findingPhotoMetaSchema = z.strictObject({
  mediaId: idSchema,
  contentType: findingPhotoSchema.shape.mimeType,
  size: z.number().int().nonnegative().nullable(),
  createdAt: timestampSchema,
});

/**
 * What `getFindingMedia` returns for `GET /api/findings/[id]/photos/[mediaId]`.
 * `storageKey` is the object-storage key. `contentType` matches
 * `findingPhotoMetaSchema`. `size` is null because the length is not
 * stored. No public URL. Server-side only.
 */
export const findingMediaContentSchema = z.strictObject({
  storageKey: findingPhotoSchema.shape.storageKey,
  contentType: findingPhotoSchema.shape.mimeType,
  size: z.number().int().nonnegative().nullable(),
});

/**
 * One finding as stored. Columns that exist on `issues`: `id`, `code`,
 * `assetId`, `description`, `severity`, `stage`, `zone`, `locationLabel`,
 * `location`, `createdAt`. There is no title column and no notes column.
 * `stage` is `findingStageSchema` (every `work_stage` value, not only
 * `discovered`). `severity` is `findingSeveritySchema`.
 */
export const findingRecordSchema = z.strictObject({
  id: idSchema,
  code: z.string().trim().min(1).max(MAX_FINDING_CODE_LENGTH),
  assetId: idSchema,
  description: z.string(),
  severity: findingSeveritySchema,
  stage: findingStageSchema,
  zone: z.string().nullable(),
  locationLabel: z.string().nullable(),
  /** Null when the stored jsonb value is not an object. */
  location: findingLocationSchema.nullable(),
  createdAt: timestampSchema,
  asset: findingAssetSummarySchema,
  photos: z.array(findingPhotoMetaSchema),
});

export type FindingStage = z.infer<typeof findingStageSchema>;
export type FindingSeverity = z.infer<typeof findingSeveritySchema>;
/**
 * A location object, or null when a stored value cannot be parsed as one.
 * Writers still store an object (`findingLocationSchema`); the null is
 * only for readers.
 */
export type FindingLocation = z.infer<typeof findingLocationSchema> | null;
export type CreateFindingFields = z.infer<typeof createFindingFieldsSchema>;
export type FindingPhoto = z.infer<typeof findingPhotoSchema>;
export type InitialFindingStageTransition = z.infer<
  typeof initialFindingStageTransitionSchema
>;
export type CreateFindingResult = z.infer<typeof createFindingResultSchema>;
export type FindingListFilters = z.infer<typeof findingListFiltersSchema>;
export type FindingAssetGroupSummary = z.infer<
  typeof findingAssetGroupSummarySchema
>;
export type FindingAssetSummary = z.infer<typeof findingAssetSummarySchema>;
export type FindingPhotoMeta = z.infer<typeof findingPhotoMetaSchema>;
export type FindingMediaContent = z.infer<typeof findingMediaContentSchema>;
export type FindingRecord = z.infer<typeof findingRecordSchema>;

/**
 * Body of POST /api/findings/{id}/stage.
 * `toStage` is `findingStageSchema`, the same values as `work_stage`.
 * The actor is not a field. Until sessions exist (#13) it is handled
 * the same way `uploadedBy` is on POST /api/findings.
 */
export const advanceFindingStageFieldsSchema = z.strictObject({
  toStage: findingStageSchema,
});

/**
 * 200 body from POST /api/findings/{id}/stage.
 * `id` is `stage_transitions.issue_id`. `transitionedAt` is `changed_at`.
 */
export const advanceFindingStageResultSchema = z.strictObject({
  id: idSchema,
  stage: findingStageSchema,
  transitionedAt: timestampSchema,
});

export type AdvanceFindingStageFields = z.infer<
  typeof advanceFindingStageFieldsSchema
>;
export type AdvanceFindingStageResult = z.infer<
  typeof advanceFindingStageResultSchema
>;

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
 *
 * The 2000-character cap is the length of `JSON.stringify` of the parsed
 * object, so a string and an already-parsed object share one limit. A
 * multipart string longer than that is rejected before it is parsed.
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
      if (
        JSON.stringify(parsed.data).length > MAX_FINDING_LOCATION_JSON_LENGTH
      ) {
        ctx.addIssue({
          code: "custom",
          message: `location must be at most ${MAX_FINDING_LOCATION_JSON_LENGTH} characters`,
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

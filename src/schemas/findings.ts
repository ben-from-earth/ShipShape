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

/**
 * Multipart text fields for POST /api/findings. Names are the `issues`
 * columns a field technician can send. The server assigns id, code, stage,
 * createdAt, and updatedAt. Photos travel in the repeated `photos` file
 * field and are not part of this object.
 *
 * `issues` has no title, summary, or severity column. Those keys are
 * rejected here. Adding either one needs a migration first: a short title
 * (what `damageReportCreateSchema` calls `summary`) would be a new
 * `issues.summary` column, and severity would be a new `issues.severity`
 * column.
 */
export const createFindingFieldsSchema = z.strictObject({
  assetId: trimmed(idSchema),
  description: z.string().trim().min(1).max(MAX_FINDING_DESCRIPTION_LENGTH),
  zone: optionalText(MAX_FINDING_ZONE_LENGTH),
  locationLabel: optionalText(MAX_FINDING_LOCATION_LABEL_LENGTH),
  location: optionalLocation(),
  reportedBy: optionalUuid(),
  discoveredAt: optionalTimestamp(),
});

/**
 * One stored photo: an `issue_media` row. Bytes stay in object storage.
 * `issueId` is the parent finding and is not repeated here. `caption` is
 * null when the create request did not send one.
 */
export const findingPhotoSchema = z.object({
  id: idSchema,
  storageKey: z.string().trim().min(1).max(STORAGE_KEY_MAX_LENGTH),
  mimeType: z.enum(FINDING_PHOTO_STORED_MEDIA_TYPES),
  caption: z.string().trim().min(1).max(MAX_FINDING_CAPTION_LENGTH).nullable(),
});

/** Body of the 201 response from POST /api/findings. */
export const createFindingResultSchema = z.object({
  id: idSchema,
  code: z.string().trim().min(1).max(MAX_FINDING_CODE_LENGTH),
  stage: z.literal("discovered"),
  createdAt: timestampSchema,
  photos: z
    .array(findingPhotoSchema)
    .min(MIN_FINDING_PHOTOS)
    .max(MAX_FINDING_PHOTOS),
});

export type FindingStage = z.infer<typeof findingStageSchema>;
export type FindingLocation = z.infer<typeof findingLocationSchema>;
export type CreateFindingFields = z.infer<typeof createFindingFieldsSchema>;
export type FindingPhoto = z.infer<typeof findingPhotoSchema>;
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

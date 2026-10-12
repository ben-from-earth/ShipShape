import { z } from "zod";

import {
  idSchema,
  longTextSchema,
  shortTextSchema,
  timestampSchema,
} from "@/schemas";

/**
 * PLACEHOLDER for Back End's findings contract (PR #16) and for
 * `SEVERITIES` from Database Manager's sequence PR.
 *
 * TODO: delete this entire file once `src/schemas/findings.ts`,
 * `src/config/findings.ts`, and `src/config/severity.ts` have merged.
 * Import those modules directly. Do not move these exports into
 * `src/schemas` or `src/config`. Do not import severity from
 * `src/db/schema.ts`: that pulls Drizzle into the client bundle.
 *
 * The text fields follow the `issues` columns a field tech can set
 * (`assetId`, `description`, `zone`, `locationLabel`). Title and severity
 * are collected with that report. The asset group is not part of the
 * request. The 201 body is `{ id, code, stage, createdAt, photos }`.
 */

/** TODO: import from `@/config/findings`. */
export const FINDING_PHOTO_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** TODO: import `MAX_FINDING_PHOTO_BYTES` from `@/config/findings`. */
export const MAX_FINDING_PHOTO_BYTES = 8 * 1024 * 1024;

/** TODO: import `MAX_FINDING_PHOTOS` from `@/config/findings`. */
export const MAX_FINDING_PHOTOS = 6;

/**
 * TODO: import `{ SEVERITIES }` from `@/config/severity`. That module is a
 * plain `as const` array. Do not import it from `@/db/schema`.
 */
export const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type FindingSeverity = (typeof SEVERITIES)[number];

const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => (value ? value : undefined));

/** TODO: import `findingFormSchema` from `@/schemas/findings`. */
export const findingFormSchema = z.object({
  assetId: idSchema,
  title: shortTextSchema,
  description: longTextSchema,
  severity: z.enum(SEVERITIES),
  zone: optionalText,
  locationLabel: optionalText,
});

export type FindingForm = z.infer<typeof findingFormSchema>;

const findingPhotoSchema = z.object({
  id: idSchema,
  mimeType: z.string().trim().min(1).max(100),
});

/** TODO: import `findingCreatedSchema` from `@/schemas/findings`. */
export const findingCreatedSchema = z.object({
  id: idSchema,
  code: z.string().trim().min(1).max(40),
  stage: z.string().trim().min(1).max(40),
  createdAt: timestampSchema,
  photos: z.array(findingPhotoSchema),
});

export type FindingCreated = z.infer<typeof findingCreatedSchema>;

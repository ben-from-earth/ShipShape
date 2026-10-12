import { z } from "zod";

import {
  idSchema,
  longTextSchema,
  shortTextSchema,
  timestampSchema,
} from "@/schemas";

/**
 * PLACEHOLDER for Back End's findings contract.
 *
 * TODO: delete this entire file once `src/schemas/findings.ts` and
 * `src/config/findings.ts` have merged. Import those modules directly.
 * Do not move these exports into `src/schemas` or `src/config`.
 *
 * The text fields follow the `issues` columns a field tech can set
 * (`assetId`, `description`, `zone`, `locationLabel`). Title, severity,
 * and notes are collected with that report. The 201 body is
 * `{ id, code, stage, createdAt, photos }`.
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

export const FINDING_SEVERITIES = ["low", "medium", "high"] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalNotes = z
  .string()
  .trim()
  .max(5_000)
  .optional()
  .transform((value) => (value ? value : undefined));

/** TODO: import `findingFormSchema` from `@/schemas/findings`. */
export const findingFormSchema = z.object({
  assetId: idSchema,
  title: shortTextSchema,
  description: longTextSchema,
  severity: z.enum(FINDING_SEVERITIES),
  zone: optionalText,
  locationLabel: optionalText,
  notes: optionalNotes,
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

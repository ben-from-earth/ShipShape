import { z } from "zod";

import {
  idSchema,
  longTextSchema,
  shortTextSchema,
  timestampSchema,
} from "./common";

/**
 * A photo attached to a damage report. Bytes live in object storage;
 * this record points at them.
 */
export const damagePhotoSchema = z.object({
  id: idSchema,
  storageKey: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(1).max(100),
  caption: z.string().trim().max(500).optional(),
});

export const damagePhotoCreateSchema = damagePhotoSchema.omit({ id: true });

export const damageReportStatusSchema = z.enum([
  "submitted",
  "in_repair",
  "closed",
]);

/**
 * What a field technician sends in. At least one photo is required.
 * The server assigns id, status, and timestamps.
 */
export const damageReportCreateSchema = z.object({
  assetId: z.string().trim().min(1).max(100),
  summary: shortTextSchema,
  description: longTextSchema,
  reportedBy: shortTextSchema,
  photos: z.array(damagePhotoCreateSchema).min(1),
});

export const damageReportSchema = damageReportCreateSchema.extend({
  id: idSchema,
  status: damageReportStatusSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  photos: z.array(damagePhotoSchema).min(1),
});

export type DamagePhoto = z.infer<typeof damagePhotoSchema>;
export type DamagePhotoCreate = z.infer<typeof damagePhotoCreateSchema>;
export type DamageReportStatus = z.infer<typeof damageReportStatusSchema>;
export type DamageReportCreate = z.infer<typeof damageReportCreateSchema>;
export type DamageReport = z.infer<typeof damageReportSchema>;

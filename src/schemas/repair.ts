import { z } from "zod";

import { MAX_FINDING_CODE_LENGTH } from "@/config/findings";
import {
  MAX_REPAIR_CODE_LENGTH,
  MAX_REPAIR_TITLE_LENGTH,
  MAX_REPAIR_TYPE_LENGTH,
  REPAIR_STATUSES,
} from "@/config/repairs";

import { idSchema, timestampSchema } from "./common";

/** Same list as `REPAIR_STATUSES` in src/config/repairs.ts. */
export const repairStatusSchema = z.enum(REPAIR_STATUSES);

const repairTitleSchema = z.string().trim().min(1).max(MAX_REPAIR_TITLE_LENGTH);
const repairTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_REPAIR_TYPE_LENGTH)
  .nullable();

/** Finding the repair was opened from. `id` is `repairs.issue_id`. */
export const repairFindingSchema = z.strictObject({
  id: idSchema,
  code: z.string().trim().min(1).max(MAX_FINDING_CODE_LENGTH),
});

/**
 * Asset that finding belongs to. `name` is null when `assets.name` is null.
 */
export const repairAssetSchema = z.strictObject({
  id: idSchema,
  identifier: z.string(),
  name: z.string().nullable(),
});

/**
 * A repair row plus the finding and asset from the same join.
 * `findingId` is `repairs.issue_id`. `createdBy` is the user who opened it,
 * or null for rows that existed before that column. `finding` and `asset`
 * are not columns on `repairs`. There is no storage key on this record.
 */
export const repairSchema = z.strictObject({
  id: idSchema,
  code: z.string().trim().min(1).max(MAX_REPAIR_CODE_LENGTH),
  findingId: idSchema,
  title: repairTitleSchema,
  type: repairTypeSchema,
  status: repairStatusSchema,
  createdBy: idSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  finding: repairFindingSchema,
  asset: repairAssetSchema,
});

/**
 * Generic fields for opening a repair. `orgId` and `actorId` are arguments
 * to `createRepair`, not part of this payload. `actorId` may be null until
 * a session exists (#13). `status` defaults to `draft`.
 */
export const repairCreateSchema = z.strictObject({
  findingId: idSchema,
  title: repairTitleSchema,
  type: repairTypeSchema.optional(),
  status: repairStatusSchema.optional(),
});

/** Optional filters for `listRepairs`. */
export const repairListFiltersSchema = z.strictObject({
  findingId: idSchema.optional(),
  status: repairStatusSchema.optional(),
});

export type RepairStatus = z.infer<typeof repairStatusSchema>;
export type Repair = z.infer<typeof repairSchema>;
export type RepairCreate = z.infer<typeof repairCreateSchema>;
export type RepairListFilters = z.infer<typeof repairListFiltersSchema>;

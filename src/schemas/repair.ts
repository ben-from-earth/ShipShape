import { z } from "zod";

import {
  idSchema,
  longTextSchema,
  shortTextSchema,
  timestampSchema,
} from "./common";

export const repairStatusSchema = z.enum(["open", "in_review", "completed"]);

/** A repair opened from a damage report. */
export const repairCreateSchema = z.object({
  damageReportId: idSchema,
  summary: shortTextSchema,
  description: longTextSchema,
  createdBy: shortTextSchema,
});

export const repairSchema = repairCreateSchema.extend({
  id: idSchema,
  status: repairStatusSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type RepairStatus = z.infer<typeof repairStatusSchema>;
export type RepairCreate = z.infer<typeof repairCreateSchema>;
export type Repair = z.infer<typeof repairSchema>;

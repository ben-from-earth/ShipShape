import { z } from "zod";

import { repairCreateSchema, repairSchema } from "./repair";

/**
 * JSON body of POST /api/findings/{id}/repairs.
 *
 * `title`, `type`, and `status` are the `createRepair` inputs a client
 * sends. `findingId` is the path `id`. `orgId` comes from `x-org-id`.
 * `actorId` is not a field. `type` and `status` may be omitted; `status`
 * defaults to `draft` inside `createRepair`.
 */
export const createRepairFieldsSchema = z.strictObject({
  title: repairCreateSchema.shape.title,
  type: repairCreateSchema.shape.type,
  status: repairCreateSchema.shape.status,
});

/**
 * 201 body from POST /api/findings/{id}/repairs.
 * Same record as `getRepair`: the repair row plus `finding` and `asset`
 * from the insert's join. `findingId` is `repairs.issue_id`.
 * `createdBy` is `repairs.created_by` and is null until sessions exist.
 */
export const createRepairResultSchema = repairSchema;

export type CreateRepairFields = z.infer<typeof createRepairFieldsSchema>;
export type CreateRepairResult = z.infer<typeof createRepairResultSchema>;

import "server-only";

import { repairCreateSchema, type RepairCreate } from "@/schemas";

/**
 * Generic fields for opening a repair. Callers pass untrusted input.
 * `createRepair` in `src/features/repairs/data.ts` persists the row and
 * checks that the finding belongs to the organization.
 */
export function parseRepairCreate(input: unknown): RepairCreate {
  return repairCreateSchema.parse(input);
}

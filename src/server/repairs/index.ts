import "server-only";

import { repairCreateSchema, type RepairCreate } from "@/schemas";

/**
 * A repair is opened from an existing damage report.
 * Callers pass untrusted input; this parses it and returns the typed payload.
 * Persistence is added with the database schema.
 */
export function parseRepairCreate(input: unknown): RepairCreate {
  return repairCreateSchema.parse(input);
}

import "server-only";

import { damageReportCreateSchema, type DamageReportCreate } from "@/schemas";

/**
 * Field technicians report damage with one or more photos.
 * Callers pass untrusted input; this parses it and returns the typed payload.
 * Persistence is added with the database schema.
 */
export function parseDamageReportCreate(input: unknown): DamageReportCreate {
  return damageReportCreateSchema.parse(input);
}

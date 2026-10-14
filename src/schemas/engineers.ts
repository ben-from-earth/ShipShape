import { z } from "zod";

import { idSchema, shortTextSchema, timestampSchema } from "./common";

/**
 * Engineer directory contract. This file is the only place those schemas
 * are defined. It imports no database module, so client code can use it.
 *
 * Roles are ordered. A higher role inherits every action a lower role can
 * perform. `ENGINEER_ROLE_RANK` is that order.
 */

export const engineerRoleSchema = z.enum(["analyst", "reviewer", "approver"]);

export const ENGINEER_ROLE_RANK = {
  analyst: 0,
  reviewer: 1,
  approver: 2,
} as const satisfies Record<z.infer<typeof engineerRoleSchema>, number>;

const engineerEmailSchema = z.string().trim().pipe(z.email());

/** One engineer. `createdAt` is when the directory row was stored. */
export const engineerSchema = z.strictObject({
  id: idSchema,
  name: shortTextSchema,
  email: engineerEmailSchema,
  role: engineerRoleSchema,
  createdAt: timestampSchema,
});

/** Fields a caller sends to add an engineer. The server assigns id and createdAt. */
export const engineerCreateSchema = engineerSchema.omit({
  id: true,
  createdAt: true,
});

export type EngineerRole = z.infer<typeof engineerRoleSchema>;
export type Engineer = z.infer<typeof engineerSchema>;
export type EngineerCreate = z.infer<typeof engineerCreateSchema>;

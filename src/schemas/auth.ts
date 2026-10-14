import { z } from "zod";

/**
 * Sign-in payload. The organization comes from `x-org-id`, not the body.
 * Unknown keys are rejected.
 */
export const signInBodySchema = z.strictObject({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(1).max(200),
});

export type SignInBody = z.infer<typeof signInBodySchema>;

import { z } from "zod";

/**
 * Error body for the document API: `{ error: { code, message, details? } }`.
 *
 * TODO: import `apiErrorSchema` from `@/schemas` when PR #12 lands
 * (`src/schemas/api-error.ts`). This copy matches that schema.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      "validation_error",
      "payload_too_large",
      "unsupported_media_type",
      "internal_error",
    ]),
    message: z.string().min(1),
    details: z
      .array(
        z.object({
          path: z.string(),
          message: z.string(),
        }),
      )
      .optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

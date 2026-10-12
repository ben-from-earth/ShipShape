import { z } from "zod";

/** Stable codes for document API failures. The route picks HTTP status from the code. */
export const apiErrorCodeSchema = z.enum([
  "validation_error",
  "payload_too_large",
  "unsupported_media_type",
  "internal_error",
]);

/** One field problem, used when a request fails validation. */
export const apiErrorDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});

/**
 * Error body for the document API.
 * `details` is omitted for failures that are not about a specific field.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1),
    details: z.array(apiErrorDetailSchema).optional(),
  }),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

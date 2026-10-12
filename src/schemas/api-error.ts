import { z } from "zod";

/**
 * Stable codes for HTTP API failures. The route picks HTTP status from the code.
 *
 * Document and finding routes share `validation_error`, `payload_too_large`,
 * `unsupported_media_type`, `invalid_org_id`, `unknown_organization`, and
 * `internal_error`. Finding routes also use `asset_not_found` and
 * `too_many_photos`.
 */
export const apiErrorCodeSchema = z.enum([
  "validation_error",
  "invalid_org_id",
  "unknown_organization",
  "asset_not_found",
  "too_many_photos",
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
 * Error body for the HTTP API.
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

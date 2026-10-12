import { z } from "zod";

/**
 * Stable codes for HTTP API failures. The route picks HTTP status from the code.
 *
 * Document routes use `validation_error`, `payload_too_large`, and
 * `unsupported_media_type`. Finding routes use `validation_failed`,
 * `asset_not_found`, `too_many_photos`, `photo_too_large`, and
 * `unsupported_photo_type`. Both use `invalid_org_id`,
 * `unknown_organization`, and `internal_error`.
 */
export const apiErrorCodeSchema = z.enum([
  "validation_error",
  "validation_failed",
  "invalid_org_id",
  "unknown_organization",
  "asset_not_found",
  "too_many_photos",
  "payload_too_large",
  "photo_too_large",
  "unsupported_media_type",
  "unsupported_photo_type",
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

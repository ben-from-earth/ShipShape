import "server-only";

import { apiErrorSchema, idSchema } from "@/schemas";

import { detailsFromZod, DocumentRequestError } from "../documents/errors";

export const ORG_ID_HEADER = "x-org-id";

export const INTERNAL_ERROR_MESSAGE = "Something went wrong.";

export function readOrgId(request: Request): string {
  const header = request.headers.get(ORG_ID_HEADER);
  const parsed = idSchema.safeParse(header ?? "");
  if (!parsed.success) {
    throw new DocumentRequestError(
      "invalid_org_id",
      "x-org-id must be the organization UUID.",
      [
        {
          path: ORG_ID_HEADER,
          message:
            detailsFromZod(parsed.error)[0]?.message ??
            "Invalid organization id",
        },
      ],
    );
  }
  return parsed.data;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new DocumentRequestError(
      "validation_error",
      "Content-Type must be application/json.",
    );
  }

  try {
    return await request.json();
  } catch {
    throw new DocumentRequestError(
      "validation_error",
      "Request body must be JSON.",
    );
  }
}

/** JSON error body matching apiErrorSchema. Unexpected errors stay generic. */
export function documentErrorResponse(error: unknown): Response {
  if (error instanceof DocumentRequestError) {
    const parsed = apiErrorSchema.safeParse({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && error.details.length > 0
          ? { details: error.details }
          : {}),
      },
    });
    if (parsed.success) {
      return Response.json(parsed.data, { status: error.status });
    }
  }

  console.error(error);
  return Response.json(
    {
      error: {
        code: "internal_error",
        message: INTERNAL_ERROR_MESSAGE,
      },
    },
    { status: 500 },
  );
}

import { z } from "zod";

import { isDemoData } from "@/config/demo";
import { ORG_ID_HEADER, orgId } from "@/config/org";
import { apiErrorDetailSchema, apiErrorSchema } from "@/schemas";

import {
  MAX_FINDING_PHOTOS,
  findingCreatedSchema,
  type FindingCreated,
} from "./contract";
import { photoProblem, toFindingForm, type FindingDraft } from "./validate";

const FINDINGS_PATH = "/api/findings";

export type FindingRequestKind = "network" | "http" | "parse";

/**
 * A finding that was not recorded.
 * `network` means `fetch` threw. `http` is any non-2xx status.
 * `parse` means the body was not the 201 schema.
 */
export class FindingRequestError extends Error {
  readonly kind: FindingRequestKind;
  readonly status: number | null;
  readonly code: string | null;

  constructor(
    message: string,
    options: {
      kind: FindingRequestKind;
      status?: number | null;
      code?: string | null;
      cause?: unknown;
    },
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "FindingRequestError";
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.code = options.code ?? null;
  }
}

/**
 * PR #16's finding codes are not on `apiErrorCodeSchema` until that
 * contract merges. Accept the same body with a string code so
 * `asset_not_found` and `too_many_photos` still map.
 */
const findingErrorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.array(apiErrorDetailSchema).optional(),
  }),
});

function messageFor(
  status: number,
  code: string | null,
  apiMessage: string | null,
  detailPaths: readonly string[],
): string {
  if (
    code === "payload_too_large" ||
    code === "photo_too_large" ||
    status === 413
  ) {
    return "Photo too large.";
  }

  if (
    code === "unsupported_media_type" ||
    code === "unsupported_photo_type" ||
    status === 415
  ) {
    return "Photo type not supported.";
  }

  if (code === "too_many_photos") {
    return `Add up to ${MAX_FINDING_PHOTOS} photos.`;
  }

  if (
    code === "invalid_org_id" ||
    code === "unknown_organization" ||
    detailPaths.some((path) => path === "x-org-id")
  ) {
    return "Organization error.";
  }

  if (
    code === "asset_not_found" ||
    detailPaths.some((path) => path.toLowerCase().includes("asset")) ||
    (apiMessage !== null && /asset/i.test(apiMessage))
  ) {
    return "Asset error.";
  }

  if (
    status === 400 ||
    code === "validation_error" ||
    code === "validation_failed"
  ) {
    return "Validation error.";
  }

  if (apiMessage) {
    return apiMessage;
  }

  return `Finding failed (${status}).`;
}

function httpFailure(
  status: number,
  code: string | null = null,
  apiMessage: string | null = null,
  detailPaths: readonly string[] = [],
): FindingRequestError {
  return new FindingRequestError(
    messageFor(status, code, apiMessage, detailPaths),
    { kind: "http", status, code },
  );
}

async function errorFromResponse(
  response: Response,
): Promise<FindingRequestError> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return httpFailure(response.status);
  }

  const parsed = apiErrorSchema.safeParse(payload);
  if (parsed.success) {
    return httpFailure(
      response.status,
      parsed.data.error.code,
      parsed.data.error.message,
      parsed.data.error.details?.map((detail) => detail.path) ?? [],
    );
  }

  const findingError = findingErrorBodySchema.safeParse(payload);
  if (!findingError.success) {
    return httpFailure(response.status);
  }

  return httpFailure(
    response.status,
    findingError.data.error.code,
    findingError.data.error.message,
    findingError.data.error.details?.map((detail) => detail.path) ?? [],
  );
}

function demoCreated(draft: FindingDraft): FindingCreated {
  return findingCreatedSchema.parse({
    id: crypto.randomUUID(),
    code: "ISS-DEMO",
    stage: "discovered",
    createdAt: new Date().toISOString(),
    photos: draft.photos.map((photo) => ({
      id: crypto.randomUUID(),
      mimeType: photo.type,
    })),
  });
}

/**
 * POST /api/findings as multipart. Photos use the repeated field `photos`.
 * Demo mode returns a fake 201 and does not call `fetch`.
 */
export async function createFinding(
  draft: FindingDraft,
  files: readonly (Blob & { name: string; type: string })[],
): Promise<FindingCreated> {
  const form = toFindingForm(draft);
  const photoError = photoProblem(draft.photos);
  if (photoError) {
    throw new Error(photoError);
  }

  if (draft.photos.length !== files.length) {
    throw new Error("Validation error.");
  }

  if (isDemoData()) {
    return demoCreated(draft);
  }

  const body = new FormData();
  body.append("assetId", form.assetId);
  body.append("title", form.title);
  body.append("description", form.description);
  body.append("severity", form.severity);
  if (form.zone) {
    body.append("zone", form.zone);
  }
  if (form.locationLabel) {
    body.append("locationLabel", form.locationLabel);
  }
  for (const file of files) {
    body.append("photos", file, file.name);
  }

  let response: Response;
  try {
    response = await fetch(FINDINGS_PATH, {
      method: "POST",
      headers: { [ORG_ID_HEADER]: orgId() },
      body,
    });
  } catch (cause) {
    throw new FindingRequestError("Could not reach findings.", {
      kind: "network",
      cause,
    });
  }

  if (!response.ok) {
    throw await errorFromResponse(response);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new FindingRequestError("Findings returned an unexpected response.", {
      kind: "parse",
      status: response.status,
      cause,
    });
  }

  const parsed = findingCreatedSchema.safeParse(payload);
  if (!parsed.success) {
    throw new FindingRequestError("Findings returned an unexpected response.", {
      kind: "parse",
      status: response.status,
      cause: parsed.error,
    });
  }

  return parsed.data;
}

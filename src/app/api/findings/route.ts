import { MAX_FINDING_PHOTO_BYTES, MAX_FINDING_PHOTOS } from "@/config/findings";
import { createFindingResultSchema } from "@/schemas";
import { assertOrganizationExists } from "@/server/documents/org";
import { createFinding } from "@/server/findings/create";
import {
  FindingRequestError,
  findingErrorResponse,
} from "@/server/findings/errors";
import { readOrgId } from "@/server/http/api";

/**
 * Extra bytes allowed on Content-Length for multipart framing around
 * MAX_FINDING_PHOTOS files of MAX_FINDING_PHOTO_BYTES.
 */
const FINDING_MULTIPART_OVERHEAD_BYTES = MAX_FINDING_PHOTOS * 256 * 1024;

export const MAX_FINDING_UPLOAD_BYTES =
  MAX_FINDING_PHOTOS * MAX_FINDING_PHOTO_BYTES +
  FINDING_MULTIPART_OVERHEAD_BYTES;

/**
 * Multipart create of a finding: text fields plus repeated `photos`.
 * This runs on the Node.js runtime, which is the App Router default.
 * The disk adapter needs Node APIs. `cacheComponents` rejects an
 * explicit `runtime` segment config.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const orgId = readOrgId(request);
    await assertOrganizationExists(orgId);
    const upload = await readFindingUpload(request);
    const result = await createFinding({ orgId, ...upload });
    return Response.json(createFindingResultSchema.parse(result), {
      status: 201,
    });
  } catch (error) {
    return findingErrorResponse(error);
  }
}

async function readFindingUpload(request: Request): Promise<{
  fields: Record<string, string>;
  photos: { fileName: string; mediaType: string; bytes: Uint8Array }[];
}> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (!Number.isInteger(length) || length < 0) {
      throw new FindingRequestError(
        "validation_error",
        "Content-Length is invalid.",
      );
    }
    if (length > MAX_FINDING_UPLOAD_BYTES) {
      throw new FindingRequestError(
        "payload_too_large",
        "The upload is larger than 10 photos of 15 MB.",
      );
    }
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new FindingRequestError(
      "validation_error",
      "Upload must be multipart/form-data.",
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new FindingRequestError(
      "validation_error",
      "Upload could not be read.",
    );
  }

  return {
    fields: readFields(form),
    photos: await readPhotos(form),
  };
}

function readFields(form: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key === "photos") {
      continue;
    }
    if (typeof value !== "string") {
      throw new FindingRequestError(
        "validation_error",
        `${key} must be text.`,
        [{ path: key, message: `${key} must be text.` }],
      );
    }
    if (Object.hasOwn(fields, key)) {
      throw new FindingRequestError(
        "validation_error",
        `${key} was sent more than once.`,
        [{ path: key, message: `${key} was sent more than once.` }],
      );
    }
    fields[key] = value;
  }
  return fields;
}

async function readPhotos(
  form: FormData,
): Promise<{ fileName: string; mediaType: string; bytes: Uint8Array }[]> {
  const photos = form.getAll("photos");
  const uploads = [];
  for (const photo of photos) {
    if (!(photo instanceof File)) {
      throw new FindingRequestError(
        "validation_error",
        "photos must be files.",
        [{ path: "photos", message: "photos must be files." }],
      );
    }
    uploads.push({
      fileName: photo.name,
      mediaType: photo.type,
      bytes: new Uint8Array(await photo.arrayBuffer()),
    });
  }
  return uploads;
}

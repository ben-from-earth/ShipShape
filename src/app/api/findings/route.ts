import { createFindingResultSchema } from "@/schemas";
import { assertOrganizationExists } from "@/server/documents/org";
import { createFinding } from "@/server/findings/create";
import {
  FindingRequestError,
  findingErrorResponse,
} from "@/server/findings/errors";
import {
  MAX_FINDING_UPLOAD_BYTES,
  readFindingMultipart,
} from "@/server/findings/multipart";
import { readOrgId } from "@/server/http/api";

export { MAX_FINDING_UPLOAD_BYTES };

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

  if (!request.body) {
    throw new FindingRequestError(
      "validation_error",
      "Upload could not be read.",
    );
  }

  return readFindingMultipart({
    stream: request.body,
    contentType,
  });
}

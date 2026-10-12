import { documentUploadResultSchema } from "@/schemas";
import { DocumentRequestError } from "@/server/documents/errors";
import {
  MAX_DOCUMENT_UPLOAD_BYTES,
  MULTIPART_OVERHEAD_BYTES,
} from "@/server/documents/file";
import { ingestDocument } from "@/server/documents/ingest";
import { assertOrganizationExists } from "@/server/documents/org";
import { documentErrorResponse, readOrgId } from "@/server/http/api";

/**
 * Multipart upload of a PDF, DOCX, TXT, or Markdown file.
 * This runs on the Node.js runtime, which is the App Router default.
 * Extraction, local embeddings, and the disk adapter need Node APIs.
 * `cacheComponents` rejects an explicit `runtime` segment config.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const orgId = readOrgId(request);
    await assertOrganizationExists(orgId);
    const upload = await readUpload(request);
    const result = await ingestDocument({ orgId, ...upload });
    return Response.json(documentUploadResultSchema.parse(result), {
      status: 201,
    });
  } catch (error) {
    return documentErrorResponse(error);
  }
}

async function readUpload(request: Request): Promise<{
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
  title?: string;
  uploadedBy?: string;
}> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (!Number.isInteger(length) || length < 0) {
      throw new DocumentRequestError(
        "validation_error",
        "Content-Length is invalid.",
      );
    }
    if (length > MAX_DOCUMENT_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
      throw new DocumentRequestError(
        "payload_too_large",
        "The file is larger than 10 MB.",
      );
    }
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new DocumentRequestError(
      "validation_error",
      "Upload must be multipart/form-data.",
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new DocumentRequestError(
      "validation_error",
      "Upload could not be read.",
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new DocumentRequestError("validation_error", "A file is required.", [
      { path: "file", message: "A file is required." },
    ]);
  }

  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw new DocumentRequestError(
      "payload_too_large",
      "The file is larger than 10 MB.",
    );
  }

  return {
    fileName: file.name,
    mediaType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
    title: readOptionalText(form, "title"),
    uploadedBy: readOptionalText(form, "uploadedBy"),
  };
}

function readOptionalText(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  if (value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new DocumentRequestError(
      "validation_error",
      `${name} must be text.`,
      [{ path: name, message: `${name} must be text.` }],
    );
  }
  return value;
}

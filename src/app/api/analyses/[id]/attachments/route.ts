import { unstable_rethrow } from "next/navigation";

import { addAttachment, getAnalysis, listAttachments } from "@/db/engineering";
import { analysisAttachmentSchema } from "@/schemas";
import {
  analysisErrorResponse,
  AnalysisRequestError,
} from "@/server/analyses/errors";
import {
  openAnalysisRequest,
  requireAnalysisId,
} from "@/server/analyses/request";
import { DocumentRequestError } from "@/server/documents/errors";
import { MULTIPART_OVERHEAD_BYTES } from "@/server/documents/file";
import {
  deleteAttachmentFile,
  maxAttachmentBytes,
  putAttachment,
} from "@/storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { db } = await openAnalysisRequest(request);
    const { id } = await context.params;
    const analysisId = requireAnalysisId(id);
    const analysis = await getAnalysis(db, analysisId);
    if (!analysis) {
      throw new AnalysisRequestError(
        "not_found",
        "That analysis was not found.",
      );
    }
    const attachments = await listAttachments(db, analysisId);
    return Response.json(analysisAttachmentSchema.array().parse(attachments));
  } catch (error) {
    unstable_rethrow(error);
    return analysisErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { tenantId, db, engineer } = await openAnalysisRequest(request);
    const { id } = await context.params;
    const analysisId = requireAnalysisId(id);
    const analysis = await getAnalysis(db, analysisId);
    if (!analysis) {
      throw new AnalysisRequestError(
        "not_found",
        "That analysis was not found.",
      );
    }
    const upload = await readUpload(request);
    const stored = await putAttachment(tenantId, {
      fileName: upload.fileName,
      contentType: upload.contentType,
      body: Buffer.from(upload.bytes),
      size: upload.bytes.byteLength,
    });
    const attachment = await addAttachment(db, {
      analysisId,
      storageKey: stored.storageKey,
      fileName: upload.fileName,
      contentType: stored.contentType,
      size: stored.size,
      uploadedBy: engineer.id,
    });
    if (!attachment) {
      await deleteAttachmentFile(tenantId, stored.storageKey);
      throw new AnalysisRequestError(
        "not_found",
        "That analysis was not found.",
      );
    }
    return Response.json(analysisAttachmentSchema.parse(attachment), {
      status: 201,
    });
  } catch (error) {
    unstable_rethrow(error);
    return analysisErrorResponse(attachmentSizeError(error) ?? error);
  }
}

async function readUpload(request: Request): Promise<{
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}> {
  const max = maxAttachmentBytes();
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (!Number.isInteger(length) || length < 0) {
      throw new DocumentRequestError(
        "validation_error",
        "Content-Length is invalid.",
      );
    }
    if (length > max + MULTIPART_OVERHEAD_BYTES) {
      throw new DocumentRequestError(
        "payload_too_large",
        `The file is larger than ${max} bytes.`,
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
  if (file.size > max) {
    throw new DocumentRequestError(
      "payload_too_large",
      `The file is larger than ${max} bytes.`,
    );
  }

  const fileName = file.name.trim() || "file";
  return {
    fileName,
    contentType: file.type.trim() || "application/octet-stream",
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}

function attachmentSizeError(error: unknown): DocumentRequestError | undefined {
  if (
    error instanceof Error &&
    error.message.startsWith("Attachment is larger than ")
  ) {
    return new DocumentRequestError("payload_too_large", error.message);
  }
  return undefined;
}

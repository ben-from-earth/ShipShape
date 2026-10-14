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
import {
  MAX_DOCUMENT_UPLOAD_BYTES,
  MULTIPART_OVERHEAD_BYTES,
} from "@/server/documents/file";
import { ingestDocument } from "@/server/documents/ingest";

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
    const document = await ingestDocument({ orgId: tenantId, ...upload });
    const attachment = await addAttachment(db, {
      analysisId,
      documentId: document.id,
      uploadedBy: engineer.id,
    });
    if (!attachment) {
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
    return analysisErrorResponse(error);
  }
}

async function readUpload(request: Request): Promise<{
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
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
  };
}

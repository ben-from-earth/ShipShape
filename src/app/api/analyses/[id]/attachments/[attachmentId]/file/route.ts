import { unstable_rethrow } from "next/navigation";

import { getAnalysis, getAttachment } from "@/db/engineering";
import { idSchema } from "@/schemas";
import {
  analysisErrorResponse,
  AnalysisRequestError,
} from "@/server/analyses/errors";
import {
  openAnalysisRequest,
  requireAnalysisId,
} from "@/server/analyses/request";
import { getAttachmentFile } from "@/storage";

function streamBytes(body: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> },
): Promise<Response> {
  try {
    const { tenantId, db } = await openAnalysisRequest(request);
    const { id, attachmentId } = await context.params;
    const analysisId = requireAnalysisId(id);
    const parsedAttachmentId = idSchema.safeParse(attachmentId);
    if (!parsedAttachmentId.success) {
      throw new AnalysisRequestError(
        "validation_error",
        "attachmentId must be a UUID.",
        [{ path: "attachmentId", message: "attachmentId must be a UUID." }],
      );
    }
    const analysis = await getAnalysis(db, analysisId);
    if (!analysis) {
      throw new AnalysisRequestError(
        "not_found",
        "That analysis was not found.",
      );
    }
    const attachment = await getAttachment(
      db,
      analysisId,
      parsedAttachmentId.data,
    );
    if (!attachment || !("storageKey" in attachment)) {
      throw new AnalysisRequestError("not_found", "That file was not found.");
    }
    const file = await getAttachmentFile(tenantId, attachment.storageKey);
    return new Response(streamBytes(file.body), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    return analysisErrorResponse(error);
  }
}

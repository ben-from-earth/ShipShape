import { unstable_rethrow } from "next/navigation";

import { addComment, getAnalysis, listComments } from "@/db/engineering";
import { analysisCommentSchema, commentCreateBodySchema } from "@/schemas";
import {
  analysisErrorResponse,
  AnalysisRequestError,
} from "@/server/analyses/errors";
import {
  openAnalysisRequest,
  parseBody,
  requireAnalysisId,
} from "@/server/analyses/request";
import { readJsonBody } from "@/server/http/api";

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
    const comments = await listComments(db, analysisId);
    return Response.json(analysisCommentSchema.array().parse(comments));
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
    const { db, engineer } = await openAnalysisRequest(request);
    const { id } = await context.params;
    const fields = parseBody(
      commentCreateBodySchema,
      await readJsonBody(request),
      "Comment fields are invalid.",
    );
    const comment = await addComment(db, {
      analysisId: requireAnalysisId(id),
      authorId: engineer.id,
      body: fields.body,
    });
    if (!comment) {
      throw new AnalysisRequestError(
        "not_found",
        "That analysis was not found.",
      );
    }
    return Response.json(analysisCommentSchema.parse(comment), { status: 201 });
  } catch (error) {
    unstable_rethrow(error);
    return analysisErrorResponse(error);
  }
}

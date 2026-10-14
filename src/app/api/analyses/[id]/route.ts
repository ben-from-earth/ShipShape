import { unstable_rethrow } from "next/navigation";

import { getAnalysis } from "@/db/engineering";
import { analysisSchema } from "@/schemas";
import {
  analysisErrorResponse,
  AnalysisRequestError,
} from "@/server/analyses/errors";
import {
  openAnalysisRequest,
  requireAnalysisId,
} from "@/server/analyses/request";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { db } = await openAnalysisRequest(request);
    const { id } = await context.params;
    const analysis = await getAnalysis(db, requireAnalysisId(id));
    if (!analysis) {
      throw new AnalysisRequestError(
        "not_found",
        "That analysis was not found.",
      );
    }
    return Response.json(analysisSchema.parse(analysis));
  } catch (error) {
    unstable_rethrow(error);
    return analysisErrorResponse(error);
  }
}

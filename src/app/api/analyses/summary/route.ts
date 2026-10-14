import { unstable_rethrow } from "next/navigation";

import { summarizeAnalyses } from "@/db/engineering";
import { analysisSummarySchema } from "@/schemas";
import { analysisErrorResponse } from "@/server/analyses/errors";
import { openAnalysisRequest } from "@/server/analyses/request";

/** Dashboard cards. The engineer header is required. Today is the UTC day. */
export async function GET(request: Request): Promise<Response> {
  try {
    const { db } = await openAnalysisRequest(request);
    const summary = await summarizeAnalyses(db);
    return Response.json(analysisSummarySchema.parse(summary));
  } catch (error) {
    unstable_rethrow(error);
    return analysisErrorResponse(error);
  }
}

import { unstable_rethrow } from "next/navigation";

import { engineerSchema } from "@/schemas";
import { analysisErrorResponse } from "@/server/analyses/errors";
import { openAnalysisRequest } from "@/server/analyses/request";

export async function GET(request: Request): Promise<Response> {
  try {
    const { engineer } = await openAnalysisRequest(request);
    return Response.json(engineerSchema.parse(engineer));
  } catch (error) {
    unstable_rethrow(error);
    return analysisErrorResponse(error);
  }
}

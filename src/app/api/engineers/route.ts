import { unstable_rethrow } from "next/navigation";

import { listEngineers } from "@/db/engineering";
import { engineerSchema } from "@/schemas";
import { analysisErrorResponse } from "@/server/analyses/errors";
import { openAnalysisRequest } from "@/server/analyses/request";

export async function GET(request: Request): Promise<Response> {
  try {
    const { db } = await openAnalysisRequest(request);
    const engineers = await listEngineers(db);
    return Response.json(engineerSchema.array().parse(engineers));
  } catch (error) {
    unstable_rethrow(error);
    return analysisErrorResponse(error);
  }
}

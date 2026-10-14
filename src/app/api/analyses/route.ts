import { unstable_rethrow } from "next/navigation";

import { listAnalyses, createAnalysis } from "@/db/engineering";
import {
  analysisCreateBodySchema,
  analysisSchema,
  createAnalysisResultSchema,
} from "@/schemas";
import { analysisErrorResponse } from "@/server/analyses/errors";
import { openAnalysisRequest, parseBody } from "@/server/analyses/request";
import { readJsonBody } from "@/server/http/api";

export async function GET(request: Request): Promise<Response> {
  try {
    const { db } = await openAnalysisRequest(request);
    const analyses = await listAnalyses(db);
    return Response.json(analysisSchema.array().parse(analyses));
  } catch (error) {
    unstable_rethrow(error);
    return analysisErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { db, engineer } = await openAnalysisRequest(request);
    const fields = parseBody(
      analysisCreateBodySchema,
      await readJsonBody(request),
      "Analysis fields are invalid.",
    );
    const analysis = await createAnalysis(db, {
      title: fields.title,
      ...(fields.dueDate !== undefined ? { dueDate: fields.dueDate } : {}),
      ...(fields.assigneeId !== undefined
        ? { assigneeId: fields.assigneeId }
        : {}),
      createdBy: engineer.id,
    });
    return Response.json(createAnalysisResultSchema.parse(analysis), {
      status: 201,
    });
  } catch (error) {
    unstable_rethrow(error);
    return analysisErrorResponse(error);
  }
}

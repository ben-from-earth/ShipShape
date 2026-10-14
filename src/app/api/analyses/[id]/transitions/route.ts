import { unstable_rethrow } from "next/navigation";

import { transitionAnalysis } from "@/db/engineering";
import {
  analysisTransitionBodySchema,
  analysisTransitionResultSchema,
} from "@/schemas";
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { db, engineer } = await openAnalysisRequest(request);
    const { id } = await context.params;
    const fields = parseBody(
      analysisTransitionBodySchema,
      await readJsonBody(request),
      "Transition fields are invalid.",
    );
    const result = await transitionAnalysis({
      db,
      analysisId: requireAnalysisId(id),
      actorId: engineer.id,
      action: fields.action,
      ...(fields.assigneeId !== undefined
        ? { assigneeId: fields.assigneeId }
        : {}),
    });
    if (result.kind === "ok") {
      return Response.json(
        analysisTransitionResultSchema.parse(result.analysis),
      );
    }
    throw transitionError(result);
  } catch (error) {
    unstable_rethrow(error);
    return analysisErrorResponse(error);
  }
}

function transitionError(
  result:
    | { kind: "not_found" }
    | { kind: "forbidden" }
    | { kind: "invalid_state"; status: string }
    | { kind: "invalid_assignee" },
): AnalysisRequestError {
  switch (result.kind) {
    case "not_found":
      return new AnalysisRequestError(
        "not_found",
        "That analysis was not found.",
      );
    case "forbidden":
      return new AnalysisRequestError(
        "forbidden",
        "That action is not allowed.",
      );
    case "invalid_state":
      return new AnalysisRequestError(
        "invalid_state",
        "That action is not allowed from this status.",
      );
    case "invalid_assignee":
      return new AnalysisRequestError(
        "invalid_assignee",
        "That assignee cannot take the analysis.",
      );
  }
}

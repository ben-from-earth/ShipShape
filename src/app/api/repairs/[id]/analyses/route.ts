import { unstable_rethrow } from "next/navigation";

import {
  analysisCreateBodySchema,
  createAnalysisResultSchema,
  type AnalysisCreateBody,
} from "@/schemas";
import { createRepairAnalysis } from "@/server/analyses/create";
import { detailsFromZod } from "@/server/documents/errors";
import { assertOrganizationExists } from "@/server/documents/org";
import { temporaryActorId } from "@/server/findings/actor";
import {
  FindingRequestError,
  findingErrorResponse,
} from "@/server/findings/errors";
import { readJsonBody, readOrgId } from "@/server/http/api";

/**
 * Opens one analysis on a repair. `createAnalysis` owns the organization
 * check and the insert. This handler validates the id and the body
 * before that call. A null actor is the session stand-in and is passed
 * through. Any other non-UUID actor is rejected first.
 *
 * `POST` reads the request. `unstable_rethrow` lets a prerender bailout
 * leave the error handler. Failures use the same response as the repair
 * route, including `payload_too_large` and `unsupported_media_type`.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const orgId = readOrgId(request);
    await assertOrganizationExists(orgId);
    const { id } = await context.params;
    const body = requireAnalysisBody(await readJsonBody(request));
    const result = await createRepairAnalysis({
      orgId,
      repairId: id,
      fields: body,
      actorId: temporaryActorId(),
    });
    return Response.json(createAnalysisResultSchema.parse(result), {
      status: 201,
    });
  } catch (error) {
    unstable_rethrow(error);
    return findingErrorResponse(error);
  }
}

function requireAnalysisBody(body: unknown): AnalysisCreateBody {
  const parsed = analysisCreateBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new FindingRequestError(
      "validation_error",
      "Analysis fields are invalid.",
      detailsFromZod(parsed.error).map((detail) => ({
        path: detail.path || "body",
        message: detail.message,
      })),
    );
  }
  return parsed.data;
}

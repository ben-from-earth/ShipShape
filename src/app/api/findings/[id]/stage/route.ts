import { unstable_rethrow } from "next/navigation";

import { advanceFindingStageResultSchema } from "@/schemas";
import { assertOrganizationExists } from "@/server/documents/org";
import { temporaryActorId } from "@/server/findings/actor";
import { findingErrorResponse } from "@/server/findings/errors";
import { changeFindingStage } from "@/server/findings/stage";
import { readJsonBody, readOrgId } from "@/server/http/api";

/**
 * Moves one finding to `toStage`. `advanceStage` owns the organization
 * check and the history row. This handler validates the id, the body,
 * and the temporary actor before that call.
 *
 * `POST` reads the request. `unstable_rethrow` lets a prerender bailout
 * leave the error handler.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const orgId = readOrgId(request);
    await assertOrganizationExists(orgId);
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const result = await changeFindingStage({
      orgId,
      findingId: id,
      body,
      actorId: temporaryActorId(),
    });
    return Response.json(advanceFindingStageResultSchema.parse(result), {
      status: 200,
    });
  } catch (error) {
    unstable_rethrow(error);
    return findingErrorResponse(error);
  }
}

import { unstable_rethrow } from "next/navigation";

import { createRepairResultSchema } from "@/schemas";
import { assertOrganizationExists } from "@/server/documents/org";
import { temporaryActorId } from "@/server/findings/actor";
import { findingErrorResponse } from "@/server/findings/errors";
import { readJsonBody, readOrgId } from "@/server/http/api";
import { createFindingRepair } from "@/server/repairs/create";

/**
 * Opens one repair on a finding. `createRepair` owns the organization
 * check and the insert. This handler validates the id and the body
 * before that call. A null actor is the session stand-in and is passed
 * through. Any other non-UUID actor is rejected first.
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
    const result = await createFindingRepair({
      orgId,
      findingId: id,
      body,
      actorId: temporaryActorId(),
    });
    return Response.json(createRepairResultSchema.parse(result), {
      status: 201,
    });
  } catch (error) {
    unstable_rethrow(error);
    return findingErrorResponse(error);
  }
}

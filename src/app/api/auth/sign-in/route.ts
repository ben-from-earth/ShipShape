import { unstable_rethrow } from "next/navigation";

import { getTenantDb } from "@/db/tenant-db";
import { engineerSchema, signInBodySchema } from "@/schemas";
import { analysisErrorResponse } from "@/server/analyses/errors";
import { parseBody } from "@/server/analyses/request";
import { sessionCookieHeader } from "@/server/auth/cookie";
import { signInEngineer } from "@/server/auth/sign-in";
import { readJsonBody, readOrgId } from "@/server/http/api";

export async function POST(request: Request): Promise<Response> {
  try {
    const tenantId = readOrgId(request);
    const db = await getTenantDb(tenantId);
    const fields = parseBody(
      signInBodySchema,
      await readJsonBody(request),
      "Sign-in fields are invalid.",
    );
    const session = await signInEngineer(db, fields);
    return Response.json(engineerSchema.parse(session.engineer), {
      headers: {
        "set-cookie": sessionCookieHeader(session.token, session.expiresAt),
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    return analysisErrorResponse(error);
  }
}

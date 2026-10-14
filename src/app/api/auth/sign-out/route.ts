import { unstable_rethrow } from "next/navigation";

import { getTenantDb } from "@/db/tenant-db";
import { analysisErrorResponse } from "@/server/analyses/errors";
import {
  clearSessionCookieHeader,
  hashSessionToken,
  readSessionToken,
} from "@/server/auth/cookie";
import { deleteSession } from "@/server/auth/store";
import { readOrgId } from "@/server/http/api";

export async function POST(request: Request): Promise<Response> {
  try {
    const tenantId = readOrgId(request);
    const db = await getTenantDb(tenantId);
    const token = readSessionToken(request);
    if (token) {
      await deleteSession(db, hashSessionToken(token));
    }
    return new Response(null, {
      status: 204,
      headers: { "set-cookie": clearSessionCookieHeader() },
    });
  } catch (error) {
    unstable_rethrow(error);
    return analysisErrorResponse(error);
  }
}

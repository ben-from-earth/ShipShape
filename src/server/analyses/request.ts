import "server-only";

import { getTenantDb } from "@/db/tenant-db";
import { idSchema, type Engineer } from "@/schemas";
import type { EngineeringDb } from "@/db/engineering";
import { readOrgId } from "@/server/http/api";

import { AnalysisRequestError } from "./errors";
import { readRequestEngineer } from "./engineer";

type BodySchema<T> = {
  safeParse: (body: unknown) =>
    | { success: true; data: T }
    | {
        success: false;
        error: {
          issues: readonly {
            code?: string;
            path: readonly PropertyKey[];
            message: string;
          }[];
        };
      };
};

export async function openAnalysisRequest(request: Request): Promise<{
  tenantId: string;
  db: EngineeringDb;
  engineer: Engineer;
}> {
  const tenantId = readOrgId(request);
  const db = await getTenantDb(tenantId);
  const engineer = await readRequestEngineer(request, db);
  return { tenantId, db, engineer };
}

export function requireAnalysisId(id: string): string {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    throw new AnalysisRequestError("validation_error", "id must be a UUID.", [
      { path: "id", message: "id must be a UUID." },
    ]);
  }
  return parsed.data;
}

/** Unknown keys use path `body`. Field errors keep their field path. */
export function parseBody<T>(
  schema: BodySchema<T>,
  body: unknown,
  message: string,
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AnalysisRequestError(
      "validation_error",
      message,
      parsed.error.issues.map((issue) => ({
        path:
          issue.path.length === 0 || issue.code === "unrecognized_keys"
            ? "body"
            : issue.path.map((part) => String(part)).join("."),
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

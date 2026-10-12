import {
  documentSearchQuerySchema,
  documentSearchResultSchema,
} from "@/schemas";
import {
  DocumentRequestError,
  detailsFromZod,
} from "@/server/documents/errors";
import { searchDocuments } from "@/server/documents/search";
import {
  documentErrorResponse,
  readJsonBody,
  readOrgId,
} from "@/server/http/api";

/**
 * Contextual search over one organization's indexed chunks.
 * The body is documentSearchQuerySchema. The organization comes from x-org-id.
 * This runs on the Node.js runtime (the App Router default) because the
 * query is embedded locally. `cacheComponents` rejects an explicit
 * `runtime` segment config.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const orgId = readOrgId(request);
    const body = await readJsonBody(request);
    const parsed = documentSearchQuerySchema.safeParse(body);
    if (!parsed.success) {
      throw new DocumentRequestError(
        "validation_error",
        "Request validation failed.",
        detailsFromZod(parsed.error),
      );
    }

    const result = await searchDocuments({
      orgId,
      query: parsed.data.query,
      limit: parsed.data.limit,
      documentId: parsed.data.documentId,
    });
    return Response.json(documentSearchResultSchema.parse(result));
  } catch (error) {
    return documentErrorResponse(error);
  }
}

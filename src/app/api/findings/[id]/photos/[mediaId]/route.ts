import { unstable_rethrow } from "next/navigation";

import { assertOrganizationExists } from "@/server/documents/org";
import {
  findingPhotoErrorResponse,
  openFindingPhoto,
} from "@/server/findings/photo";
import { readOrgId } from "@/server/http/api";

/**
 * Streams one finding photo. The bytes stay on this response.
 * Nothing here creates a public URL or a signed URL.
 *
 * `GET` reads the request, so prerendering bails out. `unstable_rethrow`
 * lets that bailout leave the error handler.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; mediaId: string }> },
): Promise<Response> {
  try {
    const orgId = readOrgId(request);
    await assertOrganizationExists(orgId);
    const { id, mediaId } = await context.params;
    const photo = await openFindingPhoto({
      orgId,
      findingId: id,
      mediaId,
    });

    return new Response(photo.stream, {
      status: 200,
      headers: {
        "Content-Type": photo.mediaType,
        "Cache-Control": "private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    return findingPhotoErrorResponse(error);
  }
}

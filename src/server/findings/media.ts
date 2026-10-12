import "server-only";

/**
 * One stored photo, as `getFindingMedia` returns it from the findings
 * readers. `size` has no `issue_media` column, so the reader leaves it null.
 */
export type FindingMediaContent = {
  storageKey: string;
  contentType: string;
  size: number | null;
};

/**
 * Loads one photo for `GET /api/findings/[id]/photos/[mediaId]`.
 *
 * The organization and media query belong to `getFindingMedia` in
 * `@/features/findings/data`. This module is only the call site. It does
 * not query `issue_media` or `assets`. Unit tests mock this function.
 * Once the readers PR is on main, re-export the real function from here.
 */
export async function getFindingMedia(
  findingId: string,
  mediaId: string,
): Promise<FindingMediaContent | null> {
  throw new Error(
    `getFindingMedia(${findingId}, ${mediaId}) from @/features/findings/data is not on this branch yet.`,
  );
}

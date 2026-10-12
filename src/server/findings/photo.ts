import "server-only";

import { FINDING_ERROR_HTTP_STATUS } from "@/config/findings";
import { getFindingMedia } from "@/features/findings/data";
import { apiErrorSchema, idSchema, type FindingMediaContent } from "@/schemas";
import {
  detailsFromZod,
  DocumentRequestError,
} from "@/server/documents/errors";
import { INTERNAL_ERROR_MESSAGE } from "@/server/http/api";
import { createLocalDiskStorage, type ObjectStorage } from "@/server/storage";

export const FINDING_PHOTO_NOT_FOUND_MESSAGE = "That photo was not found.";

/**
 * One 404 for every miss: unknown finding, another organization's asset,
 * or a media row that belongs to a different finding. The message does
 * not say which. `getFindingMedia` reports all of those as null.
 */
export class FindingPhotoNotFoundError extends Error {
  readonly code = "not_found" as const;
  readonly status = FINDING_ERROR_HTTP_STATUS.not_found;

  constructor() {
    super(FINDING_PHOTO_NOT_FOUND_MESSAGE);
    this.name = "FindingPhotoNotFoundError";
  }
}

export type OpenFindingPhotoInput = {
  findingId: string;
  mediaId: string;
};

export type GetFindingMedia = (
  findingId: string,
  mediaId: string,
) => Promise<FindingMediaContent | null>;

export type OpenFindingPhotoDependencies = {
  getFindingMedia: GetFindingMedia;
  storage: ObjectStorage;
};

/** Stream a photo after `getFindingMedia` accepts the finding and media id. */
export async function openFindingPhoto(
  input: OpenFindingPhotoInput,
  dependencies: Partial<OpenFindingPhotoDependencies> = {},
): Promise<{ stream: ReadableStream<Uint8Array>; mediaType: string }> {
  const findingId = requireUuid(input.findingId, "id");
  const mediaId = requireUuid(input.mediaId, "mediaId");
  const readMedia = dependencies.getFindingMedia ?? getFindingMedia;
  const storage = dependencies.storage ?? createLocalDiskStorage();
  const photo = await readMedia(findingId, mediaId);
  if (!photo) {
    throw new FindingPhotoNotFoundError();
  }

  const stream = await storage.read(photo.storageKey);
  if (!stream) {
    throw new FindingPhotoNotFoundError();
  }

  const mediaType = photo.contentType.trim();
  return {
    stream,
    mediaType: mediaType.length > 0 ? mediaType : "application/octet-stream",
  };
}

/** JSON error body matching apiErrorSchema. Unexpected errors stay generic. */
export function findingPhotoErrorResponse(error: unknown): Response {
  if (
    error instanceof FindingPhotoNotFoundError ||
    error instanceof DocumentRequestError
  ) {
    const details =
      error instanceof DocumentRequestError ? error.details : undefined;
    const parsed = apiErrorSchema.safeParse({
      error: {
        code: error.code,
        message: error.message,
        ...(details && details.length > 0 ? { details } : {}),
      },
    });
    if (parsed.success) {
      return Response.json(parsed.data, { status: error.status });
    }
  }

  console.error(error);
  return Response.json(
    {
      error: {
        code: "internal_error",
        message: INTERNAL_ERROR_MESSAGE,
      },
    },
    { status: 500 },
  );
}

function requireUuid(value: string, path: string): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) {
    throw new DocumentRequestError(
      "validation_error",
      `${path} must be a UUID.`,
      [
        {
          path,
          message: detailsFromZod(parsed.error)[0]?.message ?? "Invalid id",
        },
      ],
    );
  }
  return parsed.data;
}

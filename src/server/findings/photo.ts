import "server-only";

import { and, eq } from "drizzle-orm";

import { FINDING_ERROR_HTTP_STATUS } from "@/config/findings";
import { getDb, type Database } from "@/db";
import { assets, issueMedia, issues } from "@/db/schema";
import { apiErrorSchema, idSchema } from "@/schemas";
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
 * not say which.
 */
export class FindingPhotoNotFoundError extends Error {
  readonly code = "not_found" as const;
  readonly status = FINDING_ERROR_HTTP_STATUS.not_found;

  constructor() {
    super(FINDING_PHOTO_NOT_FOUND_MESSAGE);
    this.name = "FindingPhotoNotFoundError";
  }
}

export type FindingPhotoRecord = {
  storageKey: string;
  mimeType: string;
};

export type OpenFindingPhotoInput = {
  orgId: string;
  findingId: string;
  mediaId: string;
};

export type OpenFindingPhotoDependencies = {
  findPhoto: (
    input: OpenFindingPhotoInput,
  ) => Promise<FindingPhotoRecord | null>;
  storage: ObjectStorage;
};

/**
 * The photo is returned only when the finding's asset is in the
 * organization and the media row points at that finding.
 */
export async function findFindingPhoto(
  db: Database,
  input: OpenFindingPhotoInput,
): Promise<FindingPhotoRecord | null> {
  const rows = await db
    .select({
      storageKey: issueMedia.storageKey,
      mimeType: issueMedia.mimeType,
    })
    .from(issueMedia)
    .innerJoin(issues, eq(issues.id, issueMedia.issueId))
    .innerJoin(assets, eq(assets.id, issues.assetId))
    .where(
      and(
        eq(issueMedia.id, input.mediaId),
        eq(issues.id, input.findingId),
        eq(assets.orgId, input.orgId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/** Stream a photo after the organization and finding checks. */
export async function openFindingPhoto(
  input: OpenFindingPhotoInput,
  dependencies: OpenFindingPhotoDependencies = defaultDependencies(),
): Promise<{ stream: ReadableStream<Uint8Array>; mediaType: string }> {
  const orgId = requireUuid(input.orgId, "orgId");
  const findingId = requireUuid(input.findingId, "id");
  const mediaId = requireUuid(input.mediaId, "mediaId");
  const photo = await dependencies.findPhoto({ orgId, findingId, mediaId });
  if (!photo) {
    throw new FindingPhotoNotFoundError();
  }

  const stream = await dependencies.storage.read(photo.storageKey);
  if (!stream) {
    throw new FindingPhotoNotFoundError();
  }

  const mediaType = photo.mimeType.trim();
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

function defaultDependencies(): OpenFindingPhotoDependencies {
  const db = getDb();
  return {
    findPhoto: (input) => findFindingPhoto(db, input),
    storage: createLocalDiskStorage(),
  };
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

import "server-only";

import { DEMO_AS_OF } from "@/config/demo";
import {
  findingListFiltersSchema,
  findingRecordSchema,
  idSchema,
  type FindingListFilters,
  type FindingMediaContent,
  type FindingRecord,
} from "@/schemas";

/**
 * Fixture finding for a process with no `DATABASE_URL`.
 * Ids and the canopy-sill text match `demoIssue` in `src/db/demo-seed.ts`.
 * The asset ids match `FINDING_ASSETS` in `./fixtures`.
 */
const DEMO_FINDING_ID = "10000000-0000-4000-8000-000000000031";
const DEMO_MEDIA_ID = "10000000-0000-4000-8000-000000000032";
const DEMO_STORAGE_KEY = "demo/issues/ISS-1001/sill.jpg";
const DEMO_CREATED_AT = `${DEMO_AS_OF}T12:00:00.000Z`;

const DEMO_FINDINGS: readonly FindingRecord[] = [
  findingRecordSchema.parse({
    id: DEMO_FINDING_ID,
    code: "ISS-1001",
    assetId: "10000000-0000-4000-8000-000000000022",
    description: "Sill shows a visible crack at the fastener line.",
    severity: "high",
    stage: "discovered",
    zone: "canopy",
    locationLabel: "LH canopy sill",
    location: { side: "LH", station: "FS 171" },
    createdAt: DEMO_CREATED_AT,
    asset: {
      id: "10000000-0000-4000-8000-000000000022",
      identifier: "DEMO-T45-001",
      name: "Demo airframe",
      assetGroup: {
        id: "10000000-0000-4000-8000-000000000021",
        name: "T-45 Goshawk",
      },
    },
    photos: [
      {
        mediaId: DEMO_MEDIA_ID,
        contentType: "image/jpeg",
        size: null,
        createdAt: DEMO_CREATED_AT,
      },
    ],
  }),
];

function matches(record: FindingRecord, filters: FindingListFilters): boolean {
  if (filters.stage !== undefined && record.stage !== filters.stage) {
    return false;
  }
  if (filters.severity !== undefined && record.severity !== filters.severity) {
    return false;
  }
  if (filters.assetId !== undefined && record.assetId !== filters.assetId) {
    return false;
  }
  return true;
}

/** Same order as the SQL reader: `createdAt` desc, then `id` desc. */
function compareFindings(left: FindingRecord, right: FindingRecord): number {
  const byCreated = right.createdAt.localeCompare(left.createdAt);
  if (byCreated !== 0) {
    return byCreated;
  }
  return right.id.localeCompare(left.id);
}

export async function listFindings(
  filters?: FindingListFilters,
): Promise<FindingRecord[]> {
  const parsed = findingListFiltersSchema.parse(filters ?? {});
  return DEMO_FINDINGS.filter((record) => matches(record, parsed)).sort(
    compareFindings,
  );
}

export async function getFinding(id: string): Promise<FindingRecord | null> {
  if (!idSchema.safeParse(id).success) {
    return null;
  }
  return DEMO_FINDINGS.find((record) => record.id === id) ?? null;
}

export async function getFindingMedia(
  findingId: string,
  mediaId: string,
): Promise<FindingMediaContent | null> {
  const finding = await getFinding(findingId);
  if (!finding || !idSchema.safeParse(mediaId).success) {
    return null;
  }
  const photo = finding.photos.find((item) => item.mediaId === mediaId);
  if (!photo) {
    return null;
  }
  return {
    storageKey: DEMO_STORAGE_KEY,
    contentType: photo.contentType,
    size: photo.size,
  };
}

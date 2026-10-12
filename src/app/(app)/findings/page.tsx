import type { Metadata } from "next";
import { Suspense } from "react";

import {
  FindingsList,
  type FindingAssetOption,
} from "@/components/findings/findings-list";
import { listFindings } from "@/features/findings/data";
import { findingFiltersFromSearchParams } from "@/features/findings/search-params";
import type { FindingSearchParams } from "@/features/findings/search-params";
import type { FindingRecord } from "@/schemas";

export const metadata: Metadata = {
  title: "Findings",
};

export default function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<FindingSearchParams>;
}) {
  return (
    <Suspense
      fallback={<p className="text-body text-ink-muted">Loading findings…</p>}
    >
      <FindingsLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function FindingsLoader({
  searchParams,
}: {
  searchParams: Promise<FindingSearchParams>;
}) {
  const filters = findingFiltersFromSearchParams(await searchParams);
  const [records, catalog] = await Promise.all([
    listFindings(filters),
    listFindings(),
  ]);

  return (
    <FindingsList
      records={records}
      assets={assetOptions(catalog)}
      filters={filters}
    />
  );
}

function assetOptions(records: readonly FindingRecord[]): FindingAssetOption[] {
  const byId = new Map<string, FindingAssetOption>();
  for (const record of records) {
    byId.set(record.asset.id, {
      id: record.asset.id,
      identifier: record.asset.identifier,
      name: record.asset.name,
    });
  }
  return [...byId.values()].sort((left, right) =>
    left.identifier.localeCompare(right.identifier),
  );
}

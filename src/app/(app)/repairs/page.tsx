import type { Metadata } from "next";
import { Suspense } from "react";

import { RepairsList } from "@/components/repairs/repairs-list";
import { listRepairViews } from "@/features/repairs/read";
import {
  repairFiltersFromSearchParams,
  type RepairSearchParams,
} from "@/features/repairs/search-params";

export const metadata: Metadata = {
  title: "Repairs",
};

export default function RepairsPage({
  searchParams,
}: {
  searchParams: Promise<RepairSearchParams>;
}) {
  return (
    <Suspense
      fallback={<p className="text-body text-ink-muted">Loading repairs…</p>}
    >
      <RepairsLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function RepairsLoader({
  searchParams,
}: {
  searchParams: Promise<RepairSearchParams>;
}) {
  const filters = repairFiltersFromSearchParams(await searchParams);
  const records = await listRepairViews(filters);
  return <RepairsList records={records} filters={filters} />;
}

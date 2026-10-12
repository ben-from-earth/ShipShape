import type { Metadata } from "next";
import { Suspense } from "react";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboards } from "@/features/dashboard/data";
import { getLowMarginThreshold } from "@/lib/org-threshold";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <Suspense
      fallback={<p className="text-body text-ink-muted">Loading dashboard…</p>}
    >
      <DashboardLoader />
    </Suspense>
  );
}

async function DashboardLoader() {
  const [periods, marginThreshold] = await Promise.all([
    getDashboards(),
    getLowMarginThreshold(),
  ]);

  return <DashboardView periods={periods} marginThreshold={marginThreshold} />;
}

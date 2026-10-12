import type { Metadata } from "next";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboards } from "@/features/dashboard/data";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return <DashboardView periods={getDashboards()} />;
}

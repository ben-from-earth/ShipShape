import type { Metadata } from "next";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboards } from "@/features/dashboard/data";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const periods = await getDashboards();
  return <DashboardView periods={periods} />;
}

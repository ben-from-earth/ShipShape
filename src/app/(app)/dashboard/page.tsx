import type { Metadata } from "next";

import { PageHeading } from "@/components/shell/page-heading";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeading eyebrow="Asset group" title="Dashboard" />
      <Card className="px-5 py-4">
        <p className="max-w-measure text-ink-3">
          Open repairs, cycle time, and items that need a look will show up here
          for the current asset.
        </p>
      </Card>
    </div>
  );
}

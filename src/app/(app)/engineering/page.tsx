import type { Metadata } from "next";

import { PageHeading } from "@/components/shell/page-heading";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Engineering",
};

export default function EngineeringPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeading eyebrow="Step 03 · Analyze" title="Engineering" />
      <Card className="px-5 py-4">
        <p className="max-w-measure text-ink-3">
          Stress and strength analyses for this asset will be listed here, with
          margins of safety and review state.
        </p>
      </Card>
    </div>
  );
}

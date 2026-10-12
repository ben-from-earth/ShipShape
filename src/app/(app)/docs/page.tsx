import type { Metadata } from "next";

import { PageHeading } from "@/components/shell/page-heading";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata: Metadata = {
  title: "Docs",
};

export default function DocsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeading eyebrow="Reference" title="Docs" />
      <p className="max-w-measure text-body-lg text-ink-3">
        Search across the publications for this asset will live here.
      </p>
      <Card className="p-[18px]">
        <Eyebrow tone="muted" size="10.5">
          Asset map
        </Eyebrow>
        <div
          data-slot="asset-map"
          className="mt-3 flex min-h-72 items-center justify-center border border-dashed border-line-strong bg-paper px-6 py-16 text-center"
        >
          <p className="max-w-measure text-ink-muted">
            The asset map will appear here.
          </p>
        </div>
      </Card>
    </div>
  );
}

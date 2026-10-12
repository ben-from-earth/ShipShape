import type { Metadata } from "next";

import { DocsSearch } from "@/components/docs/docs-search";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata: Metadata = {
  title: "Docs",
};

function AssetMap() {
  return (
    <Card className="bg-paper-raised p-[18px]">
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
  );
}

export default function DocsPage() {
  return <DocsSearch map={<AssetMap />} />;
}

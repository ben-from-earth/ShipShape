import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FindingDetail } from "@/components/findings/finding-detail";
import { getFinding } from "@/features/findings/data";
import { listRepairViews } from "@/features/repairs/read";
import { idSchema } from "@/schemas";

export const metadata: Metadata = {
  title: "Issue",
};

export default function IssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-body text-ink-muted">Loading issue…</p>}
    >
      <IssueLoader params={params} />
    </Suspense>
  );
}

async function IssueLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    notFound();
  }

  const record = await getFinding(id);
  if (!record) {
    notFound();
  }

  const repairs = await listRepairViews({ findingId: record.id });
  return <FindingDetail record={record} repairs={repairs} />;
}

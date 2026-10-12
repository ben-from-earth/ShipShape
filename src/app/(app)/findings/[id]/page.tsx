import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FindingDetail } from "@/components/findings/finding-detail";
import { getFinding } from "@/features/findings/data";
import { idSchema } from "@/schemas";

export const metadata: Metadata = {
  title: "Finding",
};

export default function FindingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-body text-ink-muted">Loading finding…</p>}
    >
      <FindingLoader params={params} />
    </Suspense>
  );
}

async function FindingLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    notFound();
  }

  const record = await getFinding(id);
  if (!record) {
    notFound();
  }

  return <FindingDetail record={record} />;
}

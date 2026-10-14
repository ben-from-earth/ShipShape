import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RepairDetail } from "@/components/repairs/repair-detail";
import { getRepairView } from "@/features/repairs/read";
import { idSchema } from "@/schemas";

export const metadata: Metadata = {
  title: "Repair",
};

export default function RepairPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-body text-ink-muted">Loading repair…</p>}
    >
      <RepairLoader params={params} />
    </Suspense>
  );
}

async function RepairLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    notFound();
  }

  const record = await getRepairView(id);
  if (!record) {
    notFound();
  }

  return <RepairDetail record={record} />;
}

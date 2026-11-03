import type { Metadata } from "next";

import { NewFindingForm } from "@/components/findings/new-finding-form";
import { PageHeading } from "@/components/shell/page-heading";

export const metadata: Metadata = {
  title: "New issue",
};

export default function NewIssuePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="Field report" title="New issue" />
      <NewFindingForm />
    </div>
  );
}

import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/eyebrow";

export function PageHeading({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1.5">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="text-h1 font-semibold">{title}</h1>
      </div>
      {actions ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

import * as React from "react";

import { cn } from "@/lib/utils";

function Card({
  className,
  tone = "surface",
  selected = false,
  hoverable = false,
  ...props
}: React.ComponentProps<"div"> & {
  tone?: "surface" | "raised";
  selected?: boolean;
  hoverable?: boolean;
}) {
  return (
    <div
      data-slot="card"
      className={cn(
        "border border-line text-ink",
        tone === "surface" ? "bg-surface" : "bg-paper-raised",
        selected && "border-ink shadow-selected",
        hoverable && "transition-colors duration-150 hover:border-ink",
        className,
      )}
      {...props}
    />
  );
}

export { Card };

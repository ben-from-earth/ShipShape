import * as React from "react";

import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-chip text-ink-3",
  accent: "bg-accent text-white",
  navy: "bg-navy text-white",
  ok: "bg-ok text-white",
  warn: "bg-warn text-white",
  outline: "border border-line bg-surface text-ink-3",
} as const;

const sizes = {
  xs: "px-[5px] py-px text-micro tracking-pill",
  sm: "px-[7px] py-[3px] text-eyebrow tracking-field",
} as const;

function StatusPill({
  className,
  label,
  tone = "neutral",
  size = "sm",
  ...props
}: React.ComponentProps<"span"> & {
  label: string;
  tone?: keyof typeof tones;
  size?: keyof typeof sizes;
}) {
  return (
    <span
      data-slot="status-pill"
      className={cn(
        "inline-flex items-center font-mono font-semibold whitespace-nowrap uppercase",
        tones[tone],
        sizes[size],
        className,
      )}
      {...props}
    >
      {label}
    </span>
  );
}

export { StatusPill };

import * as React from "react";

import { cn } from "@/lib/utils";

const tones = {
  accent: "text-accent",
  muted: "text-ink-muted",
  ink: "text-ink",
  "on-dark": "text-accent-on-dark",
} as const;

const sizes = {
  "10": "text-2xs tracking-eyebrow",
  "10.5": "text-eyebrow tracking-eyebrow",
  "11": "text-caption tracking-kicker",
} as const;

function Eyebrow({
  className,
  tone = "accent",
  size = "11",
  ...props
}: React.ComponentProps<"span"> & {
  tone?: keyof typeof tones;
  size?: keyof typeof sizes;
}) {
  return (
    <span
      data-slot="eyebrow"
      className={cn(
        "font-mono font-semibold uppercase",
        tones[tone],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export { Eyebrow };

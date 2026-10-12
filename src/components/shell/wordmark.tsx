import type { ComponentProps } from "react";
import Link from "next/link";

export function Wordmark({
  href = "/",
}: {
  href?: ComponentProps<typeof Link>["href"];
}) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-2.5 text-ink no-underline hover:text-ink"
    >
      <span className="size-3 bg-accent" aria-hidden />
      <span className="font-mono text-body font-semibold tracking-wordmark">
        SHIPSHAPE
      </span>
    </Link>
  );
}

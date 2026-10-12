import { cn } from "@/lib/utils";

const colors = {
  navy: "bg-navy",
  ink: "bg-ink",
  ok: "bg-ok",
  accent: "bg-accent",
  brown: "bg-id-brown",
  rust: "bg-id-rust",
  slate: "bg-id-slate",
  plum: "bg-id-plum",
} as const;

const sizes = {
  22: "size-[22px] text-[10px]",
  26: "size-[26px] text-[11px]",
  28: "size-7 text-[12px]",
  30: "size-[30px] text-[12px]",
} as const;

export function Avatar({
  initials,
  color = "navy",
  size = 30,
  label = "Account",
}: {
  initials: string;
  color?: keyof typeof colors;
  size?: keyof typeof sizes;
  label?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        colors[color],
        sizes[size],
      )}
    >
      {initials}
    </span>
  );
}

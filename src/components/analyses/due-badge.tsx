import { dueBadge } from "@/features/analyses/timing";

export function DueBadge({
  dueDate,
  status,
  asOf,
}: {
  dueDate: string | null;
  status: string;
  asOf: string;
}) {
  const badge = dueBadge(dueDate, status, asOf);
  if (!badge) {
    return null;
  }
  const overdue = badge === "overdue";
  return (
    <span
      className={
        overdue
          ? "bg-accent px-1.5 py-0.5 font-mono text-eyebrow font-semibold text-white uppercase"
          : "bg-warn px-1.5 py-0.5 font-mono text-eyebrow font-semibold text-white uppercase"
      }
    >
      {overdue ? "Overdue" : "Due soon"}
    </span>
  );
}

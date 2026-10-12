import Link from "next/link";

import type { Crumb } from "@/config/nav";

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-body text-ink-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-2"
            >
              {index > 0 ? (
                <span className="text-muted-warm" aria-hidden>
                  /
                </span>
              ) : null}
              {isLast || item.href === undefined ? (
                <span className={isLast ? "font-medium text-ink" : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-ink-muted no-underline hover:text-accent"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

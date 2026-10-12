"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { APP_NAV, isNavActive } from "@/config/nav";
import { cn } from "@/lib/utils";

export function NavPills() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-wrap gap-1">
      {APP_NAV.map((item) => {
        const active = isNavActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-2.5 py-[5px] text-body no-underline",
              active
                ? "bg-ink text-white hover:text-white"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

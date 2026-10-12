"use client";

import { usePathname } from "next/navigation";

import { crumbsForPath } from "@/config/nav";
import { Avatar } from "@/components/shell/avatar";
import { Breadcrumb } from "@/components/shell/breadcrumb";
import { NavPills } from "@/components/shell/nav-pills";
import { Wordmark } from "@/components/shell/wordmark";

/** Placeholder until sign-in fills the account slot. */
const placeholderUser = { initials: "JM", label: "Account" };

export function AppHeader() {
  const pathname = usePathname();
  const crumbs = crumbsForPath(pathname);

  return (
    <header className="flex flex-wrap items-center gap-6 border-b border-line bg-paper-raised px-7 py-3">
      <Wordmark />
      <NavPills />
      <Breadcrumb items={crumbs} />
      <div className="ml-auto">
        <Avatar
          initials={placeholderUser.initials}
          label={placeholderUser.label}
        />
      </div>
    </header>
  );
}

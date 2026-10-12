"use client";

import { usePathname } from "next/navigation";

import { crumbsForPath } from "@/config/nav";
import { Avatar } from "@/components/shell/avatar";
import { Breadcrumb } from "@/components/shell/breadcrumb";
import { NavPills } from "@/components/shell/nav-pills";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";

/** Placeholder until sign-in fills the account slot. */
const placeholderUser = { initials: "JM", label: "Account" };

export function AppHeader() {
  const pathname = usePathname();
  const crumbs = crumbsForPath(pathname);

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-line bg-paper-raised px-4 py-3 sm:gap-6 sm:px-7">
      <Wordmark />
      <NavPills />
      <Breadcrumb items={crumbs} />
      <div className="ml-auto flex items-center gap-2">
        <Button href="/findings/new" variant="dark" size="sm">
          New finding
        </Button>
        <Avatar
          initials={placeholderUser.initials}
          label={placeholderUser.label}
        />
      </div>
    </header>
  );
}

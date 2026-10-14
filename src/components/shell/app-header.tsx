"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { crumbsForPath } from "@/config/nav";
import { Avatar } from "@/components/shell/avatar";
import { Breadcrumb } from "@/components/shell/breadcrumb";
import { NavPills } from "@/components/shell/nav-pills";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { AuthApiError, signOut } from "@/features/auth/client";
import { useEngineer } from "@/features/auth/session";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const crumbs = crumbsForPath(pathname);
  const engineer = useEngineer();
  const [pending, setPending] = useState(false);

  async function onSignOut() {
    setPending(true);
    try {
      await signOut();
    } catch (error) {
      if (!(error instanceof AuthApiError) || error.status !== 401) {
        setPending(false);
        return;
      }
    }
    router.push("/sign-in");
  }

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-line bg-paper-raised px-4 py-3 sm:gap-6 sm:px-7">
      <Wordmark />
      <NavPills />
      <Breadcrumb items={crumbs} />
      <div className="ml-auto flex items-center gap-2">
        <Button href="/findings/new" variant="dark" size="sm">
          New finding
        </Button>
        {engineer ? (
          <>
            <span className="text-ui font-medium">{engineer.name}</span>
            <Avatar
              initials={engineerInitials(engineer.name)}
              label={engineer.name}
            />
            <Button
              type="button"
              variant="subtle"
              size="sm"
              disabled={pending}
              onClick={() => {
                void onSignOut();
              }}
            >
              Sign out
            </Button>
          </>
        ) : (
          <Avatar initials="—" label="Account" />
        )}
      </div>
    </header>
  );
}

function engineerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (!first || !last) {
    return "?";
  }
  if (parts.length === 1) {
    return first.slice(0, 2).toUpperCase();
  }
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

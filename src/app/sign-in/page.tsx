import type { Metadata } from "next";
import { Suspense } from "react";

import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-measure flex-col justify-center px-4 py-16 sm:px-7">
      <Suspense
        fallback={<p className="text-body text-ink-muted">Loading sign-in…</p>}
      >
        <SignInLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignInLoader({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  return <SignInForm next={next ?? null} />;
}

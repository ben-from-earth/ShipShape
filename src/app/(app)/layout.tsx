import { Suspense } from "react";

import { AppHeader } from "@/components/shell/app-header";
import { SessionGate } from "@/features/auth/session";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SessionGate>
      <div className="flex min-h-screen flex-col">
        <Suspense
          fallback={
            <div className="min-h-14 border-b border-line bg-paper-raised" />
          }
        >
          <AppHeader />
        </Suspense>
        <main className="mx-auto w-full max-w-app flex-1 px-4 pt-6 pb-12 sm:px-7">
          {children}
        </main>
      </div>
    </SessionGate>
  );
}

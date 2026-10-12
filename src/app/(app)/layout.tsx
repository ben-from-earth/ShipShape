import { AppHeader } from "@/components/shell/app-header";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-app flex-1 px-4 pt-6 pb-12 sm:px-7">
        {children}
      </main>
    </div>
  );
}

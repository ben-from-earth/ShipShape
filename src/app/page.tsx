import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-measure flex-col justify-center gap-6 px-7 py-16">
      <Wordmark />
      <h1 className="text-h1 font-semibold">Damage repair workflows</h1>
      <p className="text-lead text-ink-3">
        Field technicians report damage with photos. A repair is opened from
        that report, engineering reviews stress and strength, and a reviewer
        approves the result.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button href="/dashboard">Dashboard</Button>
        <Button href="/engineering" variant="outline">
          Engineering
        </Button>
        <Button href="/docs" variant="subtle">
          Docs
        </Button>
        <Button href="/tools" variant="dark">
          Tools
        </Button>
      </div>
    </main>
  );
}

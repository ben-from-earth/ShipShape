import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-measure flex-col justify-center gap-6 px-7 py-16">
      <Wordmark />
      <h1 className="text-h1 font-semibold">Damage repair workflows</h1>
      <p className="text-lead text-ink-3">
        Field technicians report an issue with photos. A repair engineer picks
        it up, and an analysis can be generated from that repair.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button href="/dashboard">Dashboard</Button>
        <Button href="/issues" variant="outline">
          Issues
        </Button>
        <Button href="/repairs" variant="subtle">
          Repairs
        </Button>
        <Button href="/analyses" variant="dark">
          Analyses
        </Button>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-neutral-500">
        ShipShape
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Damage repair workflows
      </h1>
      <p className="leading-7 text-neutral-700">
        Field technicians report damage with photos. A repair is opened from
        that report, engineering reviews stress and strength, and a reviewer
        approves the result.
      </p>
    </main>
  );
}

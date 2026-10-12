"use client";

import { useMemo, useState } from "react";

import type { UpcomingTool } from "@/config/tools";
import { PageHeading } from "@/components/shell/page-heading";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";

export function ToolCatalog({ tools }: { tools: readonly UpcomingTool[] }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();

  const visible = useMemo(() => {
    if (normalized.length === 0) {
      return tools;
    }

    return tools.filter((tool) =>
      [tool.name, tool.source, tool.description]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [normalized, tools]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        eyebrow="Engineering tools"
        title="Tools Marketplace"
        actions={
          <label className="flex h-9 min-w-60 items-center gap-2 border border-line-strong bg-surface px-3">
            <span className="font-mono text-[12px] text-ink-faint" aria-hidden>
              ⌕
            </span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search tools, vendors, methods"
              aria-label="Search tools"
              className="w-full bg-transparent text-body text-ink outline-none placeholder:text-ink-faint"
            />
          </label>
        }
      />

      <p className="max-w-measure text-body-lg text-ink-3">
        The marketplace is coming soon. Licensing and publishing are not open
        yet. These are the tools from the catalog, listed as upcoming.
      </p>

      <section className="flex flex-col gap-3 bg-ink px-6 py-6 text-paper">
        <p className="font-mono text-caption font-semibold tracking-kicker text-accent-on-dark uppercase">
          Coming soon
        </p>
        <h2 className="max-w-measure text-[21px] font-semibold tracking-tight">
          Other programs will be able to license tools maintained here.
        </h2>
        <p className="max-w-measure text-body-lg text-ink-on-dark-3">
          Packaging, validation, pricing, and publishing stay closed until the
          marketplace opens. Nothing on this page can be licensed yet.
        </p>
      </section>

      <p
        className="font-mono text-caption tracking-label text-ink-muted"
        aria-live="polite"
      >
        {visible.length} {visible.length === 1 ? "tool" : "tools"}
        {normalized.length > 0 ? " match" : " coming soon"}
      </p>

      {visible.length === 0 ? (
        <Card className="border-dashed border-line-strong bg-paper px-5 py-8 text-ink-muted">
          No tools match that search.
        </Card>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3.5">
          {visible.map((tool) => (
            <li key={tool.id}>
              <Card className="flex h-full flex-col gap-3 p-[18px]">
                <div className="flex items-start gap-3">
                  <span
                    className="inline-flex size-10 shrink-0 items-center justify-center font-mono text-body font-semibold text-white"
                    style={{ backgroundColor: tool.color }}
                    aria-hidden
                  >
                    {tool.mono}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-card-title font-semibold">
                      {tool.name}
                    </span>
                    <span className="text-[12px] text-ink-muted">
                      {tool.source}
                    </span>
                  </span>
                </div>
                <p className="text-body text-ink-3">{tool.description}</p>
                <div className="mt-auto flex items-center border-t border-line-faint pt-2.5">
                  <StatusPill label="Coming soon" tone="warn" />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

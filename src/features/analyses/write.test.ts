import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { createAnalysis, type AnalysisStore } from "./write";

describe("createAnalysis statement", () => {
  it("upserts the revision as a no-op and reads only RETURNING rows", async () => {
    let rendered = "";
    const db = {
      async execute(query: unknown) {
        const built = new PgDialect().sqlToQuery(query as never);
        rendered = built.sql;
        return { rows: [] };
      },
    } as unknown as AnalysisStore;

    await createAnalysis(
      {
        orgId: "63000000-0000-4000-8000-000000000001",
        repairId: "63000000-0000-4000-8000-000000000005",
        actorId: "63000000-0000-4000-8000-000000000003",
        title: "Limit check",
        margin: 0.05,
      },
      db,
    );

    expect(rendered).toMatch(
      /ON CONFLICT \(repair_id, rev\)\s+DO UPDATE SET rev = EXCLUDED\.rev\s+RETURNING id, repair_id/,
    );
    expect(rendered).not.toMatch(/SET rev = EXCLUDED\.rev\s*,/);
    expect(rendered).not.toMatch(/\b(?:FROM|JOIN) repair_revisions\b/);
    expect(rendered).not.toMatch(/\b(?:FROM|JOIN) analyses\b/);
    expect(rendered).not.toMatch(/\b(?:FROM|JOIN) analysis_cases\b/);
    expect(rendered.match(/nextval/g)).toHaveLength(1);
    expect(rendered).toContain("RETURNING id, repair_id");
  });
});

import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import type { StoredAnalysis } from "@/features/analyses/stored";

import { AnalysisRecordView } from "./analysis-record";
import { LoadCaseMargins } from "./load-cases";

const record: StoredAnalysis = {
  id: "10000000-0000-4000-8000-000000000051",
  code: "AN-1001",
  repairId: "10000000-0000-4000-8000-000000000041",
  revisionId: "10000000-0000-4000-8000-000000000042",
  revision: "A",
  title: "Joint check",
  method: "Hand calculation",
  loadCase: "Repeated load",
  margin: 0.12,
  status: "in_review",
  createdBy: null,
  dueDate: "2026-12-01",
  createdAt: "2026-10-06T12:00:00.000Z",
  updatedAt: "2026-10-06T12:00:00.000Z",
};

describe("LoadCaseMargins", () => {
  it("paints a margin below the passed cutoff amber and a negative margin red", () => {
    const low = renderToStaticMarkup(
      <LoadCaseMargins
        loadCase="Repeated load"
        margin={0.12}
        marginThreshold={0.25}
      />,
    );
    const negative = renderToStaticMarkup(
      <LoadCaseMargins
        loadCase="Ultimate load"
        margin={-0.02}
        marginThreshold={0.25}
      />,
    );

    expect(low).toContain("text-warn");
    expect(low).toContain("#b07d0e");
    expect(low).not.toContain("text-ok");
    expect(negative).toContain("text-accent");
    expect(negative).toContain("#c8361f");
  });

  it("treats the same positive margin as ok when it meets a lower cutoff", () => {
    const html = renderToStaticMarkup(
      <LoadCaseMargins
        loadCase="Repeated load"
        margin={0.12}
        marginThreshold={0.1}
      />,
    );

    expect(html).toContain("text-ok");
    expect(html).toContain("#2f5d50");
    expect(html).not.toContain("text-warn");
    expect(html).not.toContain("#b07d0e");
  });

  it("keeps a negative margin red when the cutoff is below zero", () => {
    const html = renderToStaticMarkup(
      <LoadCaseMargins
        loadCase="Ultimate load"
        margin={-0.02}
        marginThreshold={-1}
      />,
    );

    expect(html).toContain("text-accent");
    expect(html).toContain("#c8361f");
    expect(html).not.toContain("text-warn");
  });
});

describe("AnalysisRecordView", () => {
  it("shows the code, repair revision, method, load case, and status", () => {
    const html = renderToStaticMarkup(
      <AnalysisRecordView record={record} marginThreshold={0.25} />,
    );

    expect(html).toContain("AN-1001");
    expect(html).toContain("/repairs/10000000-0000-4000-8000-000000000041");
    expect(html).toContain("Rev A");
    expect(html).toContain("Hand calculation");
    expect(html).toContain("In review");
    expect(html).toContain("Repeated load");
    expect(html).toContain("text-warn");
  });
});

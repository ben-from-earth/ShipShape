import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import type { AnalysisView } from "@/features/analyses/view";

import { AnalysisRecordView } from "./analysis-record";
import { LoadCaseMargins } from "./load-cases";

const record: AnalysisView = {
  id: "10000000-0000-4000-8000-000000000051",
  code: "AN-1001",
  title: "Joint check",
  method: "Hand calculation",
  status: "in_review",
  repair: {
    id: "10000000-0000-4000-8000-000000000041",
    code: "REP-1001",
    revision: "A",
    title: "Replace the joint",
  },
  finding: {
    id: "10000000-0000-4000-8000-000000000031",
    code: "ISS-1001",
  },
  loadCases: [
    { name: "Repeated load", margin: 0.12 },
    { name: "Ultimate load", margin: -0.02 },
  ],
};

describe("LoadCaseMargins", () => {
  it("paints margins below the passed cutoff amber and negatives red", () => {
    const html = renderToStaticMarkup(
      <LoadCaseMargins cases={record.loadCases} marginThreshold={0.25} />,
    );

    expect(html).toContain("text-warn");
    expect(html).toContain("#b07d0e");
    expect(html).toContain("text-accent");
    expect(html).toContain("#c8361f");
    expect(html).not.toContain("text-ok");
  });

  it("treats the same positive margin as ok when it meets a lower cutoff", () => {
    const html = renderToStaticMarkup(
      <LoadCaseMargins
        cases={[{ name: "Repeated load", margin: 0.12 }]}
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
        cases={[{ name: "Ultimate load", margin: -0.02 }]}
        marginThreshold={-1}
      />,
    );

    expect(html).toContain("text-accent");
    expect(html).toContain("#c8361f");
    expect(html).not.toContain("text-warn");
  });
});

describe("AnalysisRecordView", () => {
  it("shows the code, repair revision, finding, method, and status", () => {
    const html = renderToStaticMarkup(
      <AnalysisRecordView record={record} marginThreshold={0.25} />,
    );

    expect(html).toContain("AN-1001");
    expect(html).toContain("REP-1001");
    expect(html).toContain("Rev A");
    expect(html).toContain("/repairs/10000000-0000-4000-8000-000000000041");
    expect(html).toContain("ISS-1001");
    expect(html).toContain("/findings/10000000-0000-4000-8000-000000000031");
    expect(html).toContain("Hand calculation");
    expect(html).toContain("In review");
    expect(html).toContain("text-warn");
    expect(html).toContain("text-accent");
  });
});

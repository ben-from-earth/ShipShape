import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import type { AnalysisBoardRecord } from "@/features/analyses/board";
import type { Engineer } from "@/schemas";

import { AnalysisBoardDetail } from "./analysis-board-detail";
import { AnalysisBoardList } from "./analysis-board-list";

const reviewer: Engineer = {
  id: "10000000-0000-4000-8000-000000000072",
  name: "Ren Reviewer",
  email: "ren@example.com",
  role: "reviewer",
  createdAt: "2026-09-01T12:00:00.000Z",
};

const record: AnalysisBoardRecord = {
  analysis: {
    id: "10000000-0000-4000-8000-000000000085",
    code: "AN-2005",
    title: "Edge margin",
    status: "in_review",
    assigneeId: reviewer.id,
    dueDate: "2026-10-05",
    createdAt: "2026-09-15T12:00:00.000Z",
    updatedAt: "2026-10-06T12:00:00.000Z",
    approvedAt: null,
    createdBy: null,
  },
  assignee: reviewer,
  attachments: [
    {
      id: "10000000-0000-4000-8000-000000000094",
      analysisId: "10000000-0000-4000-8000-000000000085",
      uploadedBy: reviewer.id,
      createdAt: "2026-10-03T12:00:00.000Z",
      fileName: "edge-notes.txt",
      url: "https://example.com/edge-notes.txt",
      contentType: "text/plain",
      size: 80,
    },
  ],
  comments: [
    {
      id: "10000000-0000-4000-8000-000000000093",
      analysisId: "10000000-0000-4000-8000-000000000085",
      authorId: reviewer.id,
      body: "Checking the edge distance.",
      createdAt: "2026-10-06T12:00:00.000Z",
    },
  ],
};

describe("analysis board UI", () => {
  it("shows the next moves and disables approve for a reviewer", () => {
    const html = renderToStaticMarkup(
      <AnalysisBoardDetail
        record={record}
        asOf="2026-10-06"
        actor={reviewer}
        directory={[reviewer]}
      />,
    );

    expect(html).toContain("Send back");
    expect(html).toContain("Approve");
    expect(html).toContain("disabled");
    expect(html).toContain("Overdue");
    expect(html).toContain("bg-accent");
    expect(html).toContain("edge-notes.txt");
    expect(html).toContain("Checking the edge distance.");
    expect(html).not.toContain("/repairs/");
    expect(html).not.toContain("Load case");
  });

  it("paints a due-soon badge amber", () => {
    const html = renderToStaticMarkup(
      <AnalysisBoardList
        asOf="2026-10-06"
        records={[
          {
            ...record,
            analysis: {
              ...record.analysis,
              status: "in_progress",
              dueDate: "2026-10-08",
            },
          },
        ]}
      />,
    );

    expect(html).toContain("Due soon");
    expect(html).toContain("bg-warn");
    expect(html).toContain("21d");
  });
});

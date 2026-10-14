import "server-only";

import { DEMO_AS_OF } from "@/config/demo";
import {
  analysisAttachmentSchema,
  analysisCommentSchema,
  analysisSchema,
  engineerSchema,
  type Analysis,
  type AnalysisAttachment,
  type AnalysisComment,
  type Engineer,
} from "@/schemas";

import type { AnalysisBoardRecord } from "./board";

/**
 * Demo analyses for an explicit `isDemoData()` session.
 * This module is not a stand-in for a missing database.
 */
const created = "2026-09-01T12:00:00.000Z";

export const DEMO_ENGINEERS: readonly Engineer[] = [
  engineerSchema.parse({
    id: "10000000-0000-4000-8000-000000000071",
    name: "Ada Analyst",
    email: "ada@example.com",
    role: "analyst",
    createdAt: created,
  }),
  engineerSchema.parse({
    id: "10000000-0000-4000-8000-000000000072",
    name: "Ren Reviewer",
    email: "ren@example.com",
    role: "reviewer",
    createdAt: created,
  }),
  engineerSchema.parse({
    id: "10000000-0000-4000-8000-000000000073",
    name: "Pat Approver",
    email: "pat@example.com",
    role: "approver",
    createdAt: created,
  }),
];

export const DEMO_ACTOR = DEMO_ENGINEERS[1]!;

const analyst = DEMO_ENGINEERS[0]!;
const reviewer = DEMO_ENGINEERS[1]!;
const approver = DEMO_ENGINEERS[2]!;

function analysis(
  fields: Parameters<typeof analysisSchema.parse>[0],
): Analysis {
  return analysisSchema.parse(fields);
}

const rows: readonly {
  analysis: Analysis;
  comments: readonly AnalysisComment[];
  attachments: readonly AnalysisAttachment[];
}[] = [
  {
    analysis: analysis({
      id: "10000000-0000-4000-8000-000000000081",
      code: "AN-2001",
      title: "Open joint check",
      status: "unassigned",
      assigneeId: null,
      dueDate: "2026-10-20",
      createdAt: "2026-10-04T12:00:00.000Z",
      updatedAt: "2026-10-04T12:00:00.000Z",
      approvedAt: null,
      createdBy: null,
    }),
    comments: [],
    attachments: [],
  },
  {
    analysis: analysis({
      id: "10000000-0000-4000-8000-000000000082",
      code: "AN-2002",
      title: "Sill reinforcement",
      status: "assigned",
      assigneeId: analyst.id,
      dueDate: "2026-10-05",
      createdAt: "2026-09-20T12:00:00.000Z",
      updatedAt: "2026-09-20T12:00:00.000Z",
      approvedAt: null,
      createdBy: reviewer.id,
    }),
    comments: [],
    attachments: [],
  },
  {
    analysis: analysis({
      id: "10000000-0000-4000-8000-000000000083",
      code: "AN-2003",
      title: "Doubler layup",
      status: "in_progress",
      assigneeId: analyst.id,
      dueDate: "2026-10-08",
      createdAt: "2026-10-01T12:00:00.000Z",
      updatedAt: "2026-10-01T12:00:00.000Z",
      approvedAt: null,
      createdBy: analyst.id,
    }),
    comments: [],
    attachments: [
      analysisAttachmentSchema.parse({
        id: "10000000-0000-4000-8000-000000000091",
        analysisId: "10000000-0000-4000-8000-000000000083",
        uploadedBy: analyst.id,
        createdAt: "2026-10-02T12:00:00.000Z",
        fileName: "layup-sketch.pdf",
        url: "https://example.com/layup-sketch.pdf",
        contentType: "application/pdf",
        size: 1200,
      }),
    ],
  },
  {
    analysis: analysis({
      id: "10000000-0000-4000-8000-000000000084",
      code: "AN-2004",
      title: "Fastener pattern",
      status: "waiting_for_review",
      assigneeId: reviewer.id,
      dueDate: "2026-10-09",
      createdAt: "2026-09-28T12:00:00.000Z",
      updatedAt: "2026-10-05T12:00:00.000Z",
      approvedAt: null,
      createdBy: analyst.id,
    }),
    comments: [
      analysisCommentSchema.parse({
        id: "10000000-0000-4000-8000-000000000092",
        analysisId: "10000000-0000-4000-8000-000000000084",
        authorId: analyst.id,
        body: "Ready for a first look.",
        createdAt: "2026-10-05T12:00:00.000Z",
      }),
    ],
    attachments: [],
  },
  {
    analysis: analysis({
      id: "10000000-0000-4000-8000-000000000085",
      code: "AN-2005",
      title: "Edge margin",
      status: "in_review",
      assigneeId: reviewer.id,
      dueDate: "2026-10-12",
      createdAt: "2026-09-15T12:00:00.000Z",
      updatedAt: "2026-10-06T12:00:00.000Z",
      approvedAt: null,
      createdBy: analyst.id,
    }),
    comments: [
      analysisCommentSchema.parse({
        id: "10000000-0000-4000-8000-000000000093",
        analysisId: "10000000-0000-4000-8000-000000000085",
        authorId: reviewer.id,
        body: "Checking the edge distance.",
        createdAt: "2026-10-06T12:00:00.000Z",
      }),
    ],
    attachments: [
      analysisAttachmentSchema.parse({
        id: "10000000-0000-4000-8000-000000000094",
        analysisId: "10000000-0000-4000-8000-000000000085",
        uploadedBy: reviewer.id,
        createdAt: "2026-10-03T12:00:00.000Z",
        fileName: "edge-notes.txt",
        url: "https://example.com/edge-notes.txt",
        contentType: "text/plain",
        size: 80,
      }),
    ],
  },
  {
    analysis: analysis({
      id: "10000000-0000-4000-8000-000000000086",
      code: "AN-2006",
      title: "Closed splice",
      status: "approved",
      assigneeId: approver.id,
      dueDate: "2026-09-30",
      createdAt: "2026-09-21T12:00:00.000Z",
      updatedAt: "2026-10-01T12:00:00.000Z",
      approvedAt: "2026-10-01T12:00:00.000Z",
      createdBy: approver.id,
    }),
    comments: [],
    attachments: [],
  },
];

export const DEMO_ANALYSIS_AS_OF = DEMO_AS_OF;

function engineerById(id: string | null): Engineer | null {
  if (!id) {
    return null;
  }
  return DEMO_ENGINEERS.find((engineer) => engineer.id === id) ?? null;
}

function toRecord(row: (typeof rows)[number]): AnalysisBoardRecord {
  return {
    analysis: row.analysis,
    assignee: engineerById(row.analysis.assigneeId),
    comments: row.comments,
    attachments: row.attachments,
  };
}

export function listDemoAnalyses(): readonly AnalysisBoardRecord[] {
  return rows.map(toRecord);
}

export function findDemoAnalysis(id: string): AnalysisBoardRecord | null {
  const row = rows.find((item) => item.analysis.id === id);
  return row ? toRecord(row) : null;
}

export function commentAuthor(authorId: string | null): string {
  return engineerById(authorId)?.name ?? "—";
}

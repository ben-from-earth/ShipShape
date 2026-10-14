import "server-only";

import { DEMO_AS_OF } from "@/config/demo";

import type { AnalysisBoardRecord, BoardEngineer } from "./board";

/**
 * Demo analyses for an explicit `isDemoData()` session.
 * This module is not a stand-in for a missing database.
 */
const analyst: BoardEngineer = {
  id: "10000000-0000-4000-8000-000000000071",
  name: "Ada Analyst",
  role: "analyst",
};
const reviewer: BoardEngineer = {
  id: "10000000-0000-4000-8000-000000000072",
  name: "Ren Reviewer",
  role: "reviewer",
};
const approver: BoardEngineer = {
  id: "10000000-0000-4000-8000-000000000073",
  name: "Pat Approver",
  role: "approver",
};

export const DEMO_ENGINEER_ROLE = reviewer.role;

const DEMO_ANALYSES: readonly AnalysisBoardRecord[] = [
  {
    id: "10000000-0000-4000-8000-000000000081",
    code: "AN-2001",
    title: "Open joint check",
    assignee: null,
    status: "unassigned",
    dueDate: "2026-10-20",
    createdAt: "2026-10-04T12:00:00.000Z",
    approvedAt: null,
    attachments: [],
    comments: [],
  },
  {
    id: "10000000-0000-4000-8000-000000000082",
    code: "AN-2002",
    title: "Sill reinforcement",
    assignee: analyst,
    status: "assigned",
    dueDate: "2026-10-05",
    createdAt: "2026-09-20T12:00:00.000Z",
    approvedAt: null,
    attachments: [],
    comments: [],
  },
  {
    id: "10000000-0000-4000-8000-000000000083",
    code: "AN-2003",
    title: "Doubler layup",
    assignee: analyst,
    status: "in_progress",
    dueDate: "2026-10-08",
    createdAt: "2026-10-01T12:00:00.000Z",
    approvedAt: null,
    attachments: [{ id: "att-1", name: "layup-sketch.pdf" }],
    comments: [],
  },
  {
    id: "10000000-0000-4000-8000-000000000084",
    code: "AN-2004",
    title: "Fastener pattern",
    assignee: reviewer,
    status: "waiting_for_review",
    dueDate: "2026-10-09",
    createdAt: "2026-09-28T12:00:00.000Z",
    approvedAt: null,
    attachments: [],
    comments: [
      {
        id: "c-1",
        author: analyst.name,
        body: "Ready for a first look.",
        createdAt: "2026-10-05T12:00:00.000Z",
      },
    ],
  },
  {
    id: "10000000-0000-4000-8000-000000000085",
    code: "AN-2005",
    title: "Edge margin",
    assignee: reviewer,
    status: "in_review",
    dueDate: "2026-10-12",
    createdAt: "2026-09-15T12:00:00.000Z",
    approvedAt: null,
    attachments: [{ id: "att-2", name: "edge-notes.txt" }],
    comments: [
      {
        id: "c-2",
        author: reviewer.name,
        body: "Checking the edge distance.",
        createdAt: "2026-10-06T12:00:00.000Z",
      },
    ],
  },
  {
    id: "10000000-0000-4000-8000-000000000086",
    code: "AN-2006",
    title: "Closed splice",
    assignee: approver,
    status: "approved",
    dueDate: "2026-09-30",
    createdAt: "2026-09-21T12:00:00.000Z",
    approvedAt: "2026-10-01T12:00:00.000Z",
    attachments: [],
    comments: [],
  },
];

export const DEMO_ANALYSIS_AS_OF = DEMO_AS_OF;

export function listDemoAnalyses(): readonly AnalysisBoardRecord[] {
  return DEMO_ANALYSES;
}

export function findDemoAnalysis(id: string): AnalysisBoardRecord | null {
  return DEMO_ANALYSES.find((record) => record.id === id) ?? null;
}

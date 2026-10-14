/**
 * Stand-in for the standalone analysis contract.
 *
 * TODO: import the analysis and engineer types from `@/schemas`
 * when `src/schemas/analyses.ts` and `src/schemas/engineers.ts` land.
 *
 * TODO: import `{ ANALYSIS_TRANSITIONS, canPerform }` from `@/schemas`
 * once that contract exports them. Routes will send `x-engineer-id`
 * (401 missing, 403 wrong role, 409 wrong status). Buttons are local
 * until those routes exist.
 */

export const ANALYSIS_BOARD_STATUSES = [
  "unassigned",
  "assigned",
  "in_progress",
  "waiting_for_review",
  "in_review",
  "approved",
] as const;

export type AnalysisBoardStatus = (typeof ANALYSIS_BOARD_STATUSES)[number];

export const ENGINEER_ROLES = ["analyst", "reviewer", "approver"] as const;

export type EngineerRole = (typeof ENGINEER_ROLES)[number];

const ROLE_RANK: Record<EngineerRole, number> = {
  analyst: 0,
  reviewer: 1,
  approver: 2,
};

export const ANALYSIS_STATUS_LABEL = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  in_progress: "In progress",
  waiting_for_review: "Waiting for review",
  in_review: "In review",
  approved: "Approved",
} as const satisfies Record<AnalysisBoardStatus, string>;

export type BoardEngineer = {
  id: string;
  name: string;
  role: EngineerRole;
};

export type BoardAttachment = {
  id: string;
  name: string;
};

export type BoardComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type AnalysisBoardRecord = {
  id: string;
  code: string;
  title: string;
  assignee: BoardEngineer | null;
  status: AnalysisBoardStatus;
  dueDate: string | null;
  createdAt: string;
  approvedAt: string | null;
  attachments: readonly BoardAttachment[];
  comments: readonly BoardComment[];
};

export const ANALYSIS_ACTIONS = [
  "assign",
  "start",
  "submit",
  "pick_up",
  "send_back",
  "approve",
] as const;

export type AnalysisAction = (typeof ANALYSIS_ACTIONS)[number];

export const ANALYSIS_ACTION_LABEL = {
  assign: "Assign analyst",
  start: "Start",
  submit: "Submit",
  pick_up: "Pick up for review",
  send_back: "Send back",
  approve: "Approve",
} as const satisfies Record<AnalysisAction, string>;

export type AnalysisTransition = {
  from: AnalysisBoardStatus;
  to: AnalysisBoardStatus;
  action: AnalysisAction;
  minRole: EngineerRole;
};

export const ANALYSIS_TRANSITIONS: readonly AnalysisTransition[] = [
  { from: "unassigned", to: "assigned", action: "assign", minRole: "reviewer" },
  { from: "assigned", to: "in_progress", action: "start", minRole: "analyst" },
  {
    from: "in_progress",
    to: "waiting_for_review",
    action: "submit",
    minRole: "analyst",
  },
  {
    from: "waiting_for_review",
    to: "in_review",
    action: "pick_up",
    minRole: "reviewer",
  },
  {
    from: "in_review",
    to: "in_progress",
    action: "send_back",
    minRole: "reviewer",
  },
  { from: "in_review", to: "approved", action: "approve", minRole: "approver" },
];

/** True when `role` is at least the action's minimum role. */
export function canPerform(
  role: EngineerRole,
  action: AnalysisAction,
): boolean {
  const transition = ANALYSIS_TRANSITIONS.find(
    (item) => item.action === action,
  );
  if (!transition) {
    return false;
  }
  return ROLE_RANK[role] >= ROLE_RANK[transition.minRole];
}

export type AnalysisBoardSummary = {
  counts: Record<AnalysisBoardStatus, number>;
  overdue: number;
  dueThisWeek: number;
  averageApprovalDays: number | null;
};

export function transitionsFrom(
  status: AnalysisBoardStatus,
): readonly AnalysisTransition[] {
  return ANALYSIS_TRANSITIONS.filter((item) => item.from === status);
}

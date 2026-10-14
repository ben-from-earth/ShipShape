import {
  ANALYSIS_TRANSITIONS,
  analysisActionSchema,
  analysisStatusSchema,
  canPerform,
  type Analysis,
  type AnalysisAction,
  type AnalysisAttachment,
  type AnalysisComment,
  type AnalysisStatus,
  type Engineer,
  type EngineerRole,
} from "@/schemas";

export const ANALYSIS_BOARD_STATUSES = analysisStatusSchema.options;

export const ANALYSIS_STATUS_LABEL = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  in_progress: "In progress",
  waiting_for_review: "Waiting for review",
  in_review: "In review",
  approved: "Approved",
} as const satisfies Record<AnalysisStatus, string>;

export const ANALYSIS_ACTION_LABEL = {
  assign: "Assign analyst",
  start: "Start",
  submit: "Submit",
  pick_up: "Pick up for review",
  send_back: "Send back",
  approve: "Approve",
} as const satisfies Record<AnalysisAction, string>;

export type AnalysisBoardSummary = {
  counts: Record<AnalysisStatus, number>;
  overdue: number;
  dueThisWeek: number;
  averageApprovalDays: number | null;
};

/** One analysis plus the directory rows the page shows beside it. */
export type AnalysisBoardRecord = {
  analysis: Analysis;
  assignee: Engineer | null;
  comments: readonly AnalysisComment[];
  attachments: readonly AnalysisAttachment[];
};

export function movesFrom(status: AnalysisStatus): readonly AnalysisAction[] {
  return analysisActionSchema.options.filter(
    (action) => ANALYSIS_TRANSITIONS[action].from === status,
  );
}

/**
 * Role rank from `canPerform`, plus the assignee check.
 * `assignedAnalyst` on start and submit means only that assignee may act.
 */
export function canAttempt(
  role: EngineerRole,
  action: AnalysisAction,
  actorId: string,
  assigneeId: string | null,
): boolean {
  if (!canPerform(role, action)) {
    return false;
  }
  if (!ANALYSIS_TRANSITIONS[action].assignedAnalyst) {
    return true;
  }
  return actorId === assigneeId;
}

export function attachmentLabel(file: AnalysisAttachment): string {
  return "fileName" in file ? file.fileName : "Document";
}

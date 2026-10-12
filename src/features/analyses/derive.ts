import { DEMO_AS_OF } from "@/config/demo";
import { formatShortDate } from "@/lib/dates";

import { PEOPLE, UNASSIGNED_COLOR } from "./fixtures";
import type {
  AnalysisFilter,
  AnalysisRecord,
  AnalysisSort,
  AnalysisStatus,
  AssignedPerson,
  LifecycleStep,
  PersonId,
} from "./types";

const LIFECYCLE_LABELS = ["Issue", "Repair", "Analyze", "Approve"] as const;

/** Index of the current lifecycle step. 4 means every step is complete. */
const STAGE_INDEX: Record<AnalysisStatus, number> = {
  draft: 2,
  work: 2,
  check: 2,
  rework: 1,
  ready: 3,
  done: 4,
};

export const STATUS_LABEL: Record<AnalysisStatus, string> = {
  draft: "Draft",
  work: "In analysis",
  check: "Checker review",
  rework: "Rework",
  ready: "Ready to approve",
  done: "Approved",
};

export const STATUS_NOTE: Record<AnalysisStatus, string> = {
  draft: "Analyst is setting up geometry and load cases.",
  work: "Analyst is running cases. Checker is not on it yet.",
  check: "Independent check in progress. Analyst is on standby for comments.",
  rework: "Margin below zero. The repair went back to design for a change.",
  ready: "Checked and signed. Waiting on engineering authority.",
  done: "Approved. The repair is released to the field.",
};

export const FILTERS: readonly { value: AnalysisFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "work", label: "In analysis" },
  { value: "check", label: "Checker review" },
  { value: "rework", label: "Rework" },
  { value: "ready", label: "Ready to approve" },
  { value: "done", label: "Approved" },
];

export function minMargin(cases: readonly { margin: number }[]): number | null {
  if (cases.length === 0) {
    return null;
  }

  return Math.min(...cases.map((entry) => entry.margin));
}

/** Bar fill for a margin. The scale is the one used on the analysis detail. */
export function marginBarPercent(margin: number): number {
  return Math.max(4, Math.min(100, ((margin + 0.1) / 0.8) * 100));
}

export function isOverdue(record: AnalysisRecord, asOf = DEMO_AS_OF): boolean {
  return record.status !== "done" && record.dueOn < asOf;
}

export function dueLabel(record: AnalysisRecord, asOf = DEMO_AS_OF): string {
  const date = formatShortDate(record.dueOn);

  if (record.status === "done") {
    return `Closed ${date}`;
  }

  if (isOverdue(record, asOf)) {
    return "Overdue";
  }

  return `Due ${date}`;
}

export function statusCounts(
  records: readonly AnalysisRecord[],
): Record<AnalysisFilter, number> {
  const counts: Record<AnalysisFilter, number> = {
    all: records.length,
    draft: 0,
    work: 0,
    check: 0,
    rework: 0,
    ready: 0,
    done: 0,
  };

  for (const record of records) {
    counts[record.status] += 1;
  }

  return counts;
}

export function filterAnalyses(
  records: readonly AnalysisRecord[],
  filter: AnalysisFilter,
  query: string,
): AnalysisRecord[] {
  const needle = query.trim().toLowerCase();

  return records.filter((record) => {
    if (filter !== "all" && record.status !== filter) {
      return false;
    }

    if (needle.length === 0) {
      return true;
    }

    return [record.id, record.title, record.identifier, record.zone]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}

export function sortAnalyses(
  records: readonly AnalysisRecord[],
  sort: AnalysisSort,
  asOf = DEMO_AS_OF,
): AnalysisRecord[] {
  const copy = [...records];

  if (sort === "catalog") {
    return copy.sort((left, right) => left.catalogOrder - right.catalogOrder);
  }

  if (sort === "margin") {
    return copy.sort((left, right) => {
      const leftMargin = minMargin(left.cases);
      const rightMargin = minMargin(right.cases);
      if (leftMargin == null && rightMargin == null) {
        return left.catalogOrder - right.catalogOrder;
      }
      if (leftMargin == null) {
        return 1;
      }
      if (rightMargin == null) {
        return -1;
      }
      return leftMargin - rightMargin || left.catalogOrder - right.catalogOrder;
    });
  }

  if (sort === "identifier") {
    return copy.sort(
      (left, right) =>
        left.identifier.localeCompare(right.identifier, "en", {
          numeric: true,
        }) || left.catalogOrder - right.catalogOrder,
    );
  }

  return copy.sort((left, right) => {
    const leftOverdue = isOverdue(left, asOf) ? 0 : 1;
    const rightOverdue = isOverdue(right, asOf) ? 0 : 1;
    return (
      leftOverdue - rightOverdue ||
      left.dueOn.localeCompare(right.dueOn) ||
      left.catalogOrder - right.catalogOrder
    );
  });
}

export function lifecycleSteps(status: AnalysisStatus): LifecycleStep[] {
  const stage = STAGE_INDEX[status];

  if (stage === 4) {
    return LIFECYCLE_LABELS.map((label) => ({ label, state: "complete" }));
  }

  return LIFECYCLE_LABELS.map((label, index) => {
    if (index < stage) {
      return { label, state: "done" };
    }
    if (index === stage) {
      return { label, state: status === "rework" ? "rework" : "current" };
    }
    return { label, state: "todo" };
  });
}

export function ownerLine(record: AnalysisRecord): string {
  const analyst = PEOPLE[record.analyst].name;

  if (record.status === "check" && record.checker) {
    return `${analyst} → ${PEOPLE[record.checker].name}`;
  }

  return analyst;
}

function assigned(
  id: PersonId | null,
  role: string,
  state: string,
  tone: AssignedPerson["tone"],
): AssignedPerson {
  if (!id) {
    return {
      name: "Unassigned",
      initials: "—",
      color: UNASSIGNED_COLOR,
      role,
      state: "Open",
      tone: "faint",
    };
  }

  const person = PEOPLE[id];
  return {
    name: person.name,
    initials: person.id,
    color: person.color,
    role,
    state,
    tone,
  };
}

export function peopleFor(record: AnalysisRecord): AssignedPerson[] {
  const status = record.status;
  const analyst =
    status === "draft" || status === "work"
      ? assigned(record.analyst, "Analyst", "Working", "navy")
      : status === "check"
        ? assigned(record.analyst, "Analyst", "Standby", "faint")
        : status === "rework"
          ? assigned(record.analyst, "Analyst", "Revising", "navy")
          : assigned(record.analyst, "Analyst", "Signed", "ok");

  const checker =
    status === "check"
      ? assigned(record.checker, "Checker", "Working", "navy")
      : status === "ready" || status === "done"
        ? assigned(record.checker, "Checker", "Signed", "ok")
        : status === "rework"
          ? assigned(record.checker, "Checker", "Flagged", "accent")
          : assigned(record.checker, "Checker", "Waiting", "faint");

  const approver =
    status === "ready"
      ? assigned(record.approver, "Engineering authority", "To sign", "warn")
      : status === "done"
        ? assigned(record.approver, "Engineering authority", "Approved", "ok")
        : assigned(
            record.approver,
            "Engineering authority",
            "Waiting",
            "faint",
          );

  return [analyst, checker, approver];
}

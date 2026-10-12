import type {
  DbAnalysisStatus,
  SnapshotAnalysis,
  SnapshotIssue,
  SnapshotPerson,
  SnapshotRepair,
  SnapshotRevision,
  TenantSnapshot,
} from "@/db/snapshot";
import { formatShortDate } from "@/lib/dates";

import { colorForInitials } from "./fixtures";
import type { AnalysisRecord, AnalysisStatus, PersonId } from "./types";

const NO_DUE_DATE = "9999-12-31";

type Placed = {
  issue: SnapshotIssue;
  repair: SnapshotRepair;
  revision: SnapshotRevision;
  analysis: SnapshotAnalysis;
};

/**
 * Database status, with `in_review` split by the checker's decision.
 * A signed check that is still waiting on the approver is "ready".
 */
export function mapAnalysisStatus(
  status: DbAnalysisStatus,
  reviews: readonly { decision: string; reviewerRole: string }[],
): AnalysisStatus {
  if (status === "draft") {
    return "draft";
  }
  if (status === "in_progress") {
    return "work";
  }
  if (status === "changes_requested") {
    return "rework";
  }
  if (status === "approved") {
    return "done";
  }

  const checkerSigned = reviews.some(
    (review) =>
      review.reviewerRole === "checker" && review.decision === "approved",
  );
  const approverWaiting = reviews.some(
    (review) =>
      review.reviewerRole === "approver" && review.decision === "pending",
  );

  return checkerSigned && approverWaiting ? "ready" : "check";
}

function asPersonId(initials: string): PersonId {
  return initials as PersonId;
}

function person(
  analysis: SnapshotAnalysis,
  role: SnapshotPerson["role"],
): SnapshotPerson | null {
  return analysis.people.find((entry) => entry.role === role) ?? null;
}

function logTime(at: string, now: Date): string {
  const then = Date.parse(at);
  if (!Number.isFinite(then)) {
    return at.slice(0, 10);
  }

  const minutes = Math.round((now.getTime() - then) / 60_000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  if (hours < 48) {
    return "Yesterday";
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return formatShortDate(at.slice(0, 10));
}

function toRecord(placed: Placed, now: Date): AnalysisRecord {
  const { issue, repair, revision, analysis } = placed;
  const analyst = person(analysis, "analyst");
  const checker = person(analysis, "checker");
  const approver =
    person(analysis, "approver") ??
    (analysis.owner
      ? {
          userId: "",
          name: analysis.owner.name,
          initials: analysis.owner.initials,
          role: "approver" as const,
        }
      : null);
  const analystInitials = analyst?.initials ?? analysis.owner?.initials ?? "—";
  const approverInitials = approver?.initials ?? analystInitials;
  const related = new Set([analysis.id, issue.id, repair.id]);
  const log = issue.activity
    .filter((entry) => related.has(entry.entityId))
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, 8)
    .map((entry) => ({
      time: logTime(entry.at, now),
      text: entry.message,
    }));

  return {
    id: analysis.code,
    title: analysis.title,
    identifier: issue.assetIdentifier,
    zone: issue.zone ?? "",
    status: mapAnalysisStatus(analysis.status, analysis.reviews),
    analyst: asPersonId(analystInitials),
    checker: checker ? asPersonId(checker.initials) : null,
    approver: asPersonId(approverInitials),
    dueOn: analysis.dueDate ?? NO_DUE_DATE,
    repair: {
      id: repair.code,
      revision: revision.rev,
      type: repair.type ?? "",
      title: repair.title,
      detail: revision.detail ?? "",
    },
    issue: {
      id: issue.code,
      found: `Found ${formatShortDate(issue.discoveredAt)} · ${issue.locationLabel ?? "field"}`,
    },
    method: analysis.method ?? "",
    cases: analysis.cases.map((entry) => ({
      name: entry.name,
      margin: entry.margin,
    })),
    log,
    catalogOrder: 0,
    roster: {
      analyst: {
        name: analyst?.name ?? analysis.owner?.name ?? "Unassigned",
        color: colorForInitials(analystInitials),
      },
      checker: checker
        ? { name: checker.name, color: colorForInitials(checker.initials) }
        : null,
      approver: {
        name: approver?.name ?? analysis.owner?.name ?? "Unassigned",
        color: colorForInitials(approverInitials),
      },
    },
  };
}

/** Every analysis in the tenant, oldest first, scoped by the snapshot. */
export function buildAnalysisRecords(
  snapshot: TenantSnapshot,
  now: Date,
): AnalysisRecord[] {
  const placed: Placed[] = [];

  for (const issue of snapshot.issues) {
    for (const repair of issue.repairs) {
      for (const revision of repair.revisions) {
        for (const analysis of revision.analyses) {
          placed.push({ issue, repair, revision, analysis });
        }
      }
    }
  }

  placed.sort((left, right) => {
    const byTime = left.analysis.createdAt.localeCompare(
      right.analysis.createdAt,
    );
    return byTime || left.analysis.code.localeCompare(right.analysis.code);
  });

  return placed.map((entry, index) => ({
    ...toRecord(entry, now),
    catalogOrder: index,
  }));
}

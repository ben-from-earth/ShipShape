import "server-only";

import { asc } from "drizzle-orm";

import type { Database } from "@/db";
import { thresholdFromColumn } from "@/lib/org-threshold";

import { organizations } from "./schema";
import {
  emptySnapshot,
  type DbAnalysisStatus,
  type DbReviewDecision,
  type DbUserRole,
  type DbWorkStage,
  type SnapshotIssue,
  type TenantSnapshot,
} from "./snapshot";

type Reader = Pick<Database, "query">;

function asInstant(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  return instant.toISOString();
}

function asDay(value: Date | string | null | undefined): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  return asInstant(value)?.slice(0, 10) ?? null;
}

function asStage(value: string): DbWorkStage {
  return value as DbWorkStage;
}

function asStatus(value: string): DbAnalysisStatus {
  return value as DbAnalysisStatus;
}

function asRole(value: string): DbUserRole {
  return value as DbUserRole;
}

function asDecision(value: string): DbReviewDecision {
  return value as DbReviewDecision;
}

function asMargin(value: string | number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * One organization and every issue that belongs to it through `assets.org_id`.
 * The oldest organization is the tenant until a session picks one.
 * Returns null when the database has no organizations.
 */
export async function loadTenantSnapshot(
  db: Reader,
): Promise<TenantSnapshot | null> {
  const orgs = await db.query.organizations.findMany({
    orderBy: [asc(organizations.createdAt)],
    limit: 1,
    with: {
      users: true,
      assetGroups: true,
      assets: {
        with: {
          issues: {
            with: {
              reporter: true,
              stageTransitions: true,
              repairs: {
                with: {
                  revisions: {
                    with: {
                      analyses: {
                        with: {
                          owner: true,
                          cases: true,
                          people: { with: { user: true } },
                          reviews: { with: { reviewer: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      activity: true,
    },
  });

  const org = orgs[0];
  if (!org) {
    return null;
  }

  const groupCounts = new Map<string, number>();
  for (const asset of org.assets) {
    if (asset.groupId) {
      groupCounts.set(asset.groupId, (groupCounts.get(asset.groupId) ?? 0) + 1);
    }
  }

  const rankedGroups = [...org.assetGroups].sort((left, right) => {
    const count =
      (groupCounts.get(right.id) ?? 0) - (groupCounts.get(left.id) ?? 0);
    return count || left.name.localeCompare(right.name);
  });

  const activity = org.activity.flatMap((entry) => {
    const at = asInstant(entry.createdAt);
    if (!at) {
      return [];
    }
    return [{ at, message: entry.message, entityId: entry.entityId }];
  });

  const issues: SnapshotIssue[] = [];

  for (const asset of org.assets) {
    for (const issue of asset.issues) {
      const repairIds = new Set(issue.repairs.map((repair) => repair.id));
      const analysisIds = new Set(
        issue.repairs.flatMap((repair) =>
          repair.revisions.flatMap((revision) =>
            revision.analyses.map((analysis) => analysis.id),
          ),
        ),
      );

      issues.push({
        id: issue.id,
        code: issue.code,
        zone: issue.zone,
        description: issue.description,
        stage: asStage(issue.stage),
        discoveredAt: asDay(issue.discoveredAt) ?? "1970-01-01",
        locationLabel: issue.locationLabel,
        assetId: asset.id,
        assetIdentifier: asset.identifier,
        assetOutOfService: asset.outOfService,
        reporterName: issue.reporter?.name ?? null,
        transitions: issue.stageTransitions.flatMap((transition) => {
          const at = asInstant(transition.changedAt);
          if (!at) {
            return [];
          }
          return [{ at, toStage: asStage(transition.toStage) }];
        }),
        repairs: issue.repairs.map((repair) => ({
          id: repair.id,
          code: repair.code,
          title: repair.title,
          type: repair.type,
          createdAt: asInstant(repair.createdAt) ?? "",
          revisions: repair.revisions.map((revision) => ({
            rev: revision.rev,
            detail: revision.detail,
            createdAt: asInstant(revision.createdAt) ?? "",
            analyses: revision.analyses.map((analysis) => ({
              id: analysis.id,
              code: analysis.code,
              title: analysis.title,
              method: analysis.method,
              status: asStatus(analysis.status),
              dueDate: asDay(analysis.dueDate),
              createdAt: asInstant(analysis.createdAt) ?? "",
              updatedAt: asInstant(analysis.updatedAt) ?? "",
              owner: analysis.owner
                ? {
                    name: analysis.owner.name,
                    initials: analysis.owner.initials,
                  }
                : null,
              cases: analysis.cases.flatMap((entry) => {
                const margin = asMargin(entry.margin);
                if (margin == null) {
                  return [];
                }
                return [{ name: entry.name, margin }];
              }),
              people: analysis.people.flatMap((assignment) => {
                if (!assignment.user) {
                  return [];
                }
                return [
                  {
                    userId: assignment.user.id,
                    name: assignment.user.name,
                    initials: assignment.user.initials,
                    role: asRole(assignment.role),
                  },
                ];
              }),
              reviews: analysis.reviews.map((review) => ({
                decision: asDecision(review.decision),
                reviewerRole: asRole(review.reviewer.role),
                decidedAt: asInstant(review.decidedAt),
              })),
            })),
          })),
        })),
        activity: activity.filter(
          (entry) =>
            entry.entityId === issue.id ||
            repairIds.has(entry.entityId) ||
            analysisIds.has(entry.entityId),
        ),
      });
    }
  }

  return {
    orgName: org.name,
    threshold: thresholdFromColumn(org.lowMarginThreshold),
    assetGroupName: rankedGroups[0]?.name ?? org.name,
    users: org.users.map((user) => ({
      id: user.id,
      name: user.name,
      initials: user.initials,
      role: asRole(user.role),
    })),
    assets: org.assets.map((asset) => ({
      id: asset.id,
      identifier: asset.identifier,
      outOfService: asset.outOfService,
    })),
    issues,
  };
}

export async function loadOrEmpty(db: Reader): Promise<TenantSnapshot> {
  return (await loadTenantSnapshot(db)) ?? emptySnapshot();
}

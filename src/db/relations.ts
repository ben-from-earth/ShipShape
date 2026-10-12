import { relations } from "drizzle-orm";

import {
  activityLog,
  analyses,
  analysisCases,
  analysisPeople,
  assetGroups,
  assets,
  documentChunks,
  documents,
  issueMedia,
  issues,
  organizations,
  repairRevisions,
  repairs,
  reviews,
  stageTransitions,
  toolRuns,
  users,
} from "./schema";

/**
 * Relations for `db.query`. Each foreign key is declared on one side so
 * Drizzle can walk back to the matching `many`.
 */

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  assetGroups: many(assetGroups),
  assets: many(assets),
  activity: many(activityLog),
  documents: many(documents),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  reportedIssues: many(issues),
  uploadedMedia: many(issueMedia),
  repairRevisions: many(repairRevisions),
  ownedAnalyses: many(analyses),
  analysisAssignments: many(analysisPeople),
  toolRuns: many(toolRuns),
  reviews: many(reviews),
  stageTransitions: many(stageTransitions),
  activity: many(activityLog),
  uploadedDocuments: many(documents),
}));

export const assetGroupsRelations = relations(assetGroups, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [assetGroups.orgId],
    references: [organizations.id],
  }),
  assets: many(assets),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [assets.orgId],
    references: [organizations.id],
  }),
  group: one(assetGroups, {
    fields: [assets.groupId],
    references: [assetGroups.id],
  }),
  issues: many(issues),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  asset: one(assets, {
    fields: [issues.assetId],
    references: [assets.id],
  }),
  reporter: one(users, {
    fields: [issues.reportedBy],
    references: [users.id],
  }),
  media: many(issueMedia),
  repairs: many(repairs),
  stageTransitions: many(stageTransitions),
}));

export const issueMediaRelations = relations(issueMedia, ({ one }) => ({
  issue: one(issues, {
    fields: [issueMedia.issueId],
    references: [issues.id],
  }),
  uploader: one(users, {
    fields: [issueMedia.uploadedBy],
    references: [users.id],
  }),
}));

export const repairsRelations = relations(repairs, ({ one, many }) => ({
  issue: one(issues, {
    fields: [repairs.issueId],
    references: [issues.id],
  }),
  revisions: many(repairRevisions),
}));

export const repairRevisionsRelations = relations(
  repairRevisions,
  ({ one, many }) => ({
    repair: one(repairs, {
      fields: [repairRevisions.repairId],
      references: [repairs.id],
    }),
    author: one(users, {
      fields: [repairRevisions.createdBy],
      references: [users.id],
    }),
    analyses: many(analyses),
  }),
);

export const analysesRelations = relations(analyses, ({ one, many }) => ({
  repairRevision: one(repairRevisions, {
    fields: [analyses.repairRevisionId],
    references: [repairRevisions.id],
  }),
  owner: one(users, {
    fields: [analyses.ownerId],
    references: [users.id],
  }),
  people: many(analysisPeople),
  cases: many(analysisCases),
  toolRuns: many(toolRuns),
  reviews: many(reviews),
}));

export const analysisPeopleRelations = relations(analysisPeople, ({ one }) => ({
  analysis: one(analyses, {
    fields: [analysisPeople.analysisId],
    references: [analyses.id],
  }),
  user: one(users, {
    fields: [analysisPeople.userId],
    references: [users.id],
  }),
}));

export const analysisCasesRelations = relations(analysisCases, ({ one }) => ({
  analysis: one(analyses, {
    fields: [analysisCases.analysisId],
    references: [analyses.id],
  }),
}));

export const toolRunsRelations = relations(toolRuns, ({ one }) => ({
  analysis: one(analyses, {
    fields: [toolRuns.analysisId],
    references: [analyses.id],
  }),
  author: one(users, {
    fields: [toolRuns.createdBy],
    references: [users.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  analysis: one(analyses, {
    fields: [reviews.analysisId],
    references: [analyses.id],
  }),
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
  }),
}));

export const stageTransitionsRelations = relations(
  stageTransitions,
  ({ one }) => ({
    issue: one(issues, {
      fields: [stageTransitions.issueId],
      references: [issues.id],
    }),
    actor: one(users, {
      fields: [stageTransitions.changedBy],
      references: [users.id],
    }),
  }),
);

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [activityLog.orgId],
    references: [organizations.id],
  }),
  actor: one(users, {
    fields: [activityLog.actorId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [documents.orgId],
    references: [organizations.id],
  }),
  uploader: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
  chunks: many(documentChunks),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));

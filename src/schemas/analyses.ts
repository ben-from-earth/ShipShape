import { z } from "zod";

import {
  MAX_ANALYSIS_CODE_LENGTH,
  MAX_ANALYSIS_TITLE_LENGTH,
} from "@/config/analysis";

import { idSchema, longTextSchema, timestampSchema } from "./common";
import { ENGINEER_ROLE_RANK, type EngineerRole } from "./engineers";

/**
 * Analyses Zod contract. This file is the only place those schemas are
 * defined. It imports no database module, so client code can use it.
 *
 * An analysis stands on its own. It is not opened from a repair, and it
 * does not carry a margin, load case, or method.
 */

export const analysisStatusSchema = z.enum([
  "unassigned",
  "assigned",
  "in_progress",
  "waiting_for_review",
  "in_review",
  "approved",
]);

export const analysisActionSchema = z.enum([
  "assign",
  "start",
  "submit",
  "pick_up",
  "send_back",
  "approve",
]);

const analysisTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_ANALYSIS_TITLE_LENGTH);

/** Calendar day, `YYYY-MM-DD`. */
const analysisDaySchema = z.string().trim().pipe(z.iso.date());

const analysisCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_ANALYSIS_CODE_LENGTH);

/**
 * One stored analysis.
 * `assigneeId` is null until someone is assigned.
 * `approvedAt` is null until the analysis is approved.
 * `createdBy` is null when the row was opened without a session.
 */
export const analysisSchema = z.strictObject({
  id: idSchema,
  code: analysisCodeSchema,
  title: analysisTitleSchema,
  status: analysisStatusSchema,
  assigneeId: idSchema.nullable(),
  dueDate: analysisDaySchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  approvedAt: timestampSchema.nullable(),
  createdBy: idSchema.nullable(),
});

/**
 * Fields for opening an analysis. `dueDate` and `assigneeId` may be omitted.
 * Null is not a value for either one. There is no repair id.
 */
export const analysisCreateSchema = z.strictObject({
  title: analysisTitleSchema,
  dueDate: analysisDaySchema.optional(),
  assigneeId: idSchema.optional(),
});

/**
 * JSON body for creating an analysis. Same fields as `analysisCreateSchema`:
 * analyses are not nested under a repair, so the body is that object.
 */
export const analysisCreateBodySchema = analysisCreateSchema;

/** Same record as `analysisSchema`. */
export const createAnalysisResultSchema = analysisSchema;

export type AnalysisTransition = {
  readonly from: z.infer<typeof analysisStatusSchema>;
  readonly to: z.infer<typeof analysisStatusSchema>;
  /** Lowest role that may attempt the action. Higher roles inherit it. */
  readonly minRole: EngineerRole;
  /**
   * The actor must be the assigned analyst. `canPerform` does not check
   * identity. It only compares role rank with `minRole`.
   */
  readonly assignedAnalyst: boolean;
  /** `assigneeId` is required on the transition body. */
  readonly requiresAssignee: boolean;
};

/**
 * Legal status changes. `from` is the only status the action accepts.
 * `assignedAnalyst` means the actor is the assignee, not a second role.
 */
export const ANALYSIS_TRANSITIONS = {
  assign: {
    from: "unassigned",
    to: "assigned",
    minRole: "reviewer",
    assignedAnalyst: false,
    requiresAssignee: true,
  },
  start: {
    from: "assigned",
    to: "in_progress",
    minRole: "analyst",
    assignedAnalyst: true,
    requiresAssignee: false,
  },
  submit: {
    from: "in_progress",
    to: "waiting_for_review",
    minRole: "analyst",
    assignedAnalyst: true,
    requiresAssignee: false,
  },
  pick_up: {
    from: "waiting_for_review",
    to: "in_review",
    minRole: "reviewer",
    assignedAnalyst: false,
    requiresAssignee: false,
  },
  send_back: {
    from: "in_review",
    to: "in_progress",
    minRole: "reviewer",
    assignedAnalyst: false,
    requiresAssignee: false,
  },
  approve: {
    from: "in_review",
    to: "approved",
    minRole: "approver",
    assignedAnalyst: false,
    requiresAssignee: false,
  },
} as const satisfies Record<
  z.infer<typeof analysisActionSchema>,
  AnalysisTransition
>;

/**
 * JSON body for one analysis action.
 * `assigneeId` is required when the action is `assign` and optional otherwise.
 */
export const analysisTransitionBodySchema = z
  .strictObject({
    action: analysisActionSchema,
    assigneeId: idSchema.optional(),
  })
  .superRefine((body, ctx) => {
    if (
      ANALYSIS_TRANSITIONS[body.action].requiresAssignee &&
      body.assigneeId === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["assigneeId"],
        message: "assigneeId is required.",
      });
    }
  });

/** Analysis record after a transition. Same object as `analysisSchema`. */
export const analysisTransitionResultSchema = analysisSchema;

/**
 * Whether `role` meets the minimum rank for `action`.
 * Higher roles inherit lower ones. This does not check who is assigned.
 */
export function canPerform(
  role: EngineerRole,
  action: z.infer<typeof analysisActionSchema>,
): boolean {
  return (
    ENGINEER_ROLE_RANK[role] >=
    ENGINEER_ROLE_RANK[ANALYSIS_TRANSITIONS[action].minRole]
  );
}

/** Comment stored on an analysis. `authorId` is null without a session. */
export const analysisCommentSchema = z.strictObject({
  id: idSchema,
  analysisId: idSchema,
  authorId: idSchema.nullable(),
  body: longTextSchema,
  createdAt: timestampSchema,
});

/** JSON body for a new comment. `analysisId` comes from the path. */
export const commentCreateBodySchema = z.strictObject({
  body: longTextSchema,
});

const attachmentRecord = {
  id: idSchema,
  analysisId: idSchema,
  uploadedBy: idSchema.nullable(),
  createdAt: timestampSchema,
};

/**
 * File hanging off an analysis. Either an existing document (`documentId`)
 * or an uploaded file (`fileName`, `url`, `contentType`, `size`).
 */
export const analysisAttachmentSchema = z.union([
  z.strictObject({
    ...attachmentRecord,
    documentId: idSchema,
  }),
  z.strictObject({
    ...attachmentRecord,
    fileName: z.string().trim().min(1).max(255),
    url: z.url(),
    contentType: z.string().trim().min(1).max(200),
    size: z.number().int().nonnegative(),
  }),
]);

export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;
export type AnalysisAction = z.infer<typeof analysisActionSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type AnalysisCreate = z.infer<typeof analysisCreateSchema>;
export type AnalysisCreateBody = z.infer<typeof analysisCreateBodySchema>;
export type CreateAnalysisResult = z.infer<typeof createAnalysisResultSchema>;
export type AnalysisTransitionBody = z.infer<
  typeof analysisTransitionBodySchema
>;
export type AnalysisTransitionResult = z.infer<
  typeof analysisTransitionResultSchema
>;
export type AnalysisComment = z.infer<typeof analysisCommentSchema>;
export type CommentCreateBody = z.infer<typeof commentCreateBodySchema>;
export type AnalysisAttachment = z.infer<typeof analysisAttachmentSchema>;

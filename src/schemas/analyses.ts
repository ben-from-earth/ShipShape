import { z } from "zod";

import { idSchema, timestampSchema } from "./common";

/**
 * Create-analysis HTTP contract.
 *
 * Field names and limits match `createAnalysis` and `analysisCreateSchema`
 * on #33 (`src/schemas/analysis.ts` there). That schema is not on main.
 * Main's `analysisCreateSchema` is a different payload (`stressSummary`,
 * `strengthSummary`, `conclusion`, `analyst`) and is not reused.
 *
 * `orgId` and `actorId` are `createAnalysis` arguments, not fields.
 * `status` defaults to `draft`, `revision` to `A`, and `loadCase` to
 * `Primary` inside `createAnalysis`. `method` and `dueDate` default to null.
 */

const ANALYSIS_STATUSES = [
  "draft",
  "in_progress",
  "in_review",
  "changes_requested",
  "approved",
] as const;

const analysisTitleSchema = z.string().trim().min(1).max(200);
const analysisMethodSchema = z.string().trim().min(1).max(200).nullable();
const analysisLoadCaseSchema = z.string().trim().min(1).max(200);
const analysisRevisionSchema = z.string().trim().min(1).max(32);
const analysisMarginSchema = z.number().finite().min(-99999.999).max(99999.999);
const analysisDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const analysisStatusSchema = z.enum(ANALYSIS_STATUSES);

/** JSON body for creating an analysis. Same fields as #33's `analysisCreateSchema`. */
export const createAnalysisFieldsSchema = z.strictObject({
  repairId: idSchema,
  title: analysisTitleSchema,
  method: analysisMethodSchema.optional(),
  loadCase: analysisLoadCaseSchema.optional(),
  margin: analysisMarginSchema,
  status: analysisStatusSchema.optional(),
  dueDate: analysisDaySchema.nullable().optional(),
  revision: analysisRevisionSchema.optional(),
});

/**
 * 201 body. Same fields as #33's `analysisSchema`.
 * `loadCase` is `analysis_cases.name`. `margin` is `analysis_cases.margin`.
 * Both are nullable on a stored row. `createdBy` is null until a session exists.
 */
export const createAnalysisResultSchema = z.strictObject({
  id: idSchema,
  code: z.string().trim().min(1).max(64),
  repairId: idSchema,
  revisionId: idSchema,
  revision: analysisRevisionSchema,
  title: analysisTitleSchema,
  method: analysisMethodSchema,
  loadCase: analysisLoadCaseSchema.nullable(),
  margin: analysisMarginSchema.nullable(),
  status: analysisStatusSchema,
  createdBy: idSchema.nullable(),
  dueDate: analysisDaySchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type CreateAnalysisFields = z.infer<typeof createAnalysisFieldsSchema>;
export type CreateAnalysisResult = z.infer<typeof createAnalysisResultSchema>;

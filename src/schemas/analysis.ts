import { z } from "zod";

import {
  ANALYSIS_DB_STATUSES,
  MAX_ANALYSIS_CODE_LENGTH,
  MAX_ANALYSIS_LOAD_CASE_LENGTH,
  MAX_ANALYSIS_METHOD_LENGTH,
  MAX_ANALYSIS_REVISION_LENGTH,
  MAX_ANALYSIS_TITLE_LENGTH,
} from "@/config/analysis";

import { idSchema, timestampSchema } from "./common";

/** Engineering judgment of whether the repair holds under load. */
export const analysisConclusionSchema = z.enum([
  "adequate",
  "inadequate",
  "inconclusive",
]);

/** Same list as `ANALYSIS_DB_STATUSES` in src/config/analysis.ts. */
export const analysisDbStatusSchema = z.enum(ANALYSIS_DB_STATUSES);

const analysisTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_ANALYSIS_TITLE_LENGTH);
const analysisMethodSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_ANALYSIS_METHOD_LENGTH)
  .nullable();
const analysisLoadCaseSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_ANALYSIS_LOAD_CASE_LENGTH);
const analysisRevisionSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_ANALYSIS_REVISION_LENGTH);

/**
 * Margin of safety stored on `analysis_cases.margin` (`numeric(8, 3)`).
 * The dashboard classifies this against the organization threshold.
 */
export const analysisMarginSchema = z
  .number()
  .finite()
  .min(-99999.999)
  .max(99999.999);

const analysisDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Generic fields for opening an analysis. `orgId` and `actorId` are
 * arguments to `createAnalysis`, not part of this payload. `actorId` may
 * be null until a session exists (#13). `status` defaults to `draft`.
 * `revision` defaults to `A`. `loadCase` defaults to `Primary`.
 */
export const analysisCreateSchema = z.strictObject({
  repairId: idSchema,
  title: analysisTitleSchema,
  method: analysisMethodSchema.optional(),
  loadCase: analysisLoadCaseSchema.optional(),
  margin: analysisMarginSchema,
  status: analysisDbStatusSchema.optional(),
  dueDate: analysisDaySchema.nullable().optional(),
  revision: analysisRevisionSchema.optional(),
});

/**
 * One stored analysis plus the load case used for margin classification.
 * `repairId` is the repair the revision belongs to. `createdBy` is null
 * when the row was opened without a session. There is no storage key.
 */
export const analysisSchema = z.strictObject({
  id: idSchema,
  code: z.string().trim().min(1).max(MAX_ANALYSIS_CODE_LENGTH),
  repairId: idSchema,
  revisionId: idSchema,
  revision: analysisRevisionSchema,
  title: analysisTitleSchema,
  method: analysisMethodSchema,
  loadCase: analysisLoadCaseSchema.nullable(),
  margin: analysisMarginSchema.nullable(),
  status: analysisDbStatusSchema,
  createdBy: idSchema.nullable(),
  dueDate: analysisDaySchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type AnalysisConclusion = z.infer<typeof analysisConclusionSchema>;
export type AnalysisDbStatus = z.infer<typeof analysisDbStatusSchema>;
export type AnalysisCreate = z.infer<typeof analysisCreateSchema>;
export type Analysis = z.infer<typeof analysisSchema>;

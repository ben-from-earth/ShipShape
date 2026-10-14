import type { AnalysisDbStatus } from "@/config/analysis";

/**
 * Analysis row the current repair-scoped writer returns.
 * The public contract in `src/schemas/analyses.ts` does not describe this table.
 */
export type StoredAnalysis = {
  id: string;
  code: string;
  repairId: string;
  revisionId: string;
  revision: string;
  title: string;
  method: string | null;
  loadCase: string | null;
  margin: number | null;
  status: AnalysisDbStatus;
  createdBy: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

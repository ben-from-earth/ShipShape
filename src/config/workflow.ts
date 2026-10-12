import { findingStageSchema, type FindingStage } from "@/schemas/findings";

/**
 * `work_stage` in lifecycle order. The next entry is the default forward move.
 * This module does not import the database, so client code can share the map.
 */
export const WORK_STAGE_ORDER = findingStageSchema.options;

/**
 * Rework send-backs. These are the only moves that skip the forward step.
 *
 * `review` → `analysis`: the approve step sends the finding back for analysis.
 * `analysis` → `repair_defined`: analysis sends the repair definition back.
 *
 * `approved` only moves on to `closed`. `closed` is terminal.
 */
export const STAGE_SEND_BACKS: Partial<
  Record<FindingStage, readonly FindingStage[]>
> = {
  review: ["analysis"],
  analysis: ["repair_defined"],
};

/** The next stage in {@link WORK_STAGE_ORDER}, or null when `from` is `closed`. */
export function nextStage(from: FindingStage): FindingStage | null {
  const index = WORK_STAGE_ORDER.indexOf(from);
  if (index < 0) {
    return null;
  }
  return WORK_STAGE_ORDER[index + 1] ?? null;
}

/**
 * Stages `from` may move to: the next lifecycle stage, then any send-back.
 * Same-stage is never included.
 */
export function allowedStageTargets(
  from: FindingStage,
): readonly FindingStage[] {
  const forward = nextStage(from);
  const sendBacks = STAGE_SEND_BACKS[from] ?? [];
  if (!forward) {
    return sendBacks;
  }
  return [forward, ...sendBacks];
}

/** True when `to` is the next stage or an explicit send-back. Same-stage is false. */
export function isAllowedStageTransition(
  from: FindingStage,
  to: FindingStage,
): boolean {
  if (from === to) {
    return false;
  }
  return allowedStageTargets(from).includes(to);
}

import { allowedStageTargets, nextStage } from "@/config/workflow";
import type { FindingStage } from "@/schemas";

import { STAGE_LABEL } from "./display";

export type StageActionKind = "forward" | "send-back";

export type StageAction = {
  toStage: FindingStage;
  kind: StageActionKind;
  label: string;
};

/**
 * Buttons for `stage`. `allowedStageTargets` lists the forward move first,
 * then any send-back. The first match of `nextStage` is the primary button.
 */
export function stageActions(stage: FindingStage): readonly StageAction[] {
  const forward = nextStage(stage);

  return allowedStageTargets(stage).map((toStage) => {
    const kind: StageActionKind = toStage === forward ? "forward" : "send-back";
    const name = STAGE_LABEL[toStage];

    return {
      toStage,
      kind,
      label: kind === "forward" ? `Move to ${name}` : `Send back to ${name}`,
    };
  });
}

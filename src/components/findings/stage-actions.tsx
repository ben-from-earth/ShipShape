"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { STAGE_LABEL } from "@/features/findings/display";
import {
  stageActions,
  type StageAction,
} from "@/features/findings/stage-actions";
import {
  advanceFindingStage,
  stageRequestFailure,
} from "@/features/findings/stage-client";
import type { FindingStage } from "@/schemas";

export function StageActionButtons({
  actions,
  pending,
  onSelect,
}: {
  actions: readonly StageAction[];
  pending: boolean;
  onSelect: (action: StageAction) => void;
}) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.toStage}
          variant={action.kind === "forward" ? "dark" : "subtle"}
          className="min-h-11"
          disabled={pending}
          onClick={() => {
            onSelect(action);
          }}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export function StageActions({
  findingId,
  stage,
}: {
  findingId: string;
  stage: FindingStage;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(stage);
  const [trackedStage, setTrackedStage] = useState(stage);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (stage !== trackedStage) {
    setTrackedStage(stage);
    setCurrent(stage);
  }

  const actions = stageActions(current);

  async function move(action: StageAction) {
    if (pending) {
      return;
    }

    if (action.kind === "send-back") {
      const confirmed = window.confirm(
        `Send this finding back to ${STAGE_LABEL[action.toStage]}?`,
      );
      if (!confirmed) {
        return;
      }
    }

    setPending(true);
    setError(null);
    try {
      const result = await advanceFindingStage(findingId, action.toStage);
      setCurrent(result.stage);
      router.refresh();
    } catch (caught) {
      const failure = stageRequestFailure(caught);
      setError(failure.message);
      if (failure.refresh) {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <StatusPill label={STAGE_LABEL[current]} tone="outline" />
      <StageActionButtons
        actions={actions}
        pending={pending}
        onSelect={(action) => {
          void move(action);
        }}
      />
      {error ? (
        <p className="text-body text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

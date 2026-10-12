import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { stageActions } from "@/features/findings/stage-actions";
import { findingStageSchema } from "@/schemas";

import { StageActionButtons } from "./stage-actions";

describe("stage action buttons", () => {
  it("lists the forward move first, then send-backs", () => {
    expect(stageActions("discovered")).toEqual([
      {
        toStage: "repair_defined",
        kind: "forward",
        label: "Move to Repair defined",
      },
    ]);
    expect(stageActions("repair_defined")).toEqual([
      {
        toStage: "analysis",
        kind: "forward",
        label: "Move to Analysis",
      },
    ]);
    expect(stageActions("analysis")).toEqual([
      { toStage: "review", kind: "forward", label: "Move to Review" },
      {
        toStage: "repair_defined",
        kind: "send-back",
        label: "Send back to Repair defined",
      },
    ]);
    expect(stageActions("review")).toEqual([
      { toStage: "approved", kind: "forward", label: "Move to Approved" },
      {
        toStage: "analysis",
        kind: "send-back",
        label: "Send back to Analysis",
      },
    ]);
    expect(stageActions("approved")).toEqual([
      { toStage: "closed", kind: "forward", label: "Move to Closed" },
    ]);
    expect(stageActions("closed")).toEqual([]);
  });

  it.each(findingStageSchema.options)(
    "renders the %s buttons with forward primary",
    (stage) => {
      const actions = stageActions(stage);
      const html = renderToStaticMarkup(
        <StageActionButtons
          actions={actions}
          pending={false}
          onSelect={() => undefined}
        />,
      );

      if (actions.length === 0) {
        expect(html).toBe("");
        return;
      }

      expect(html.match(/data-variant="dark"/g)).toHaveLength(1);
      expect(html).toContain(actions[0]?.label);
      const sendBacks = actions.filter((action) => action.kind === "send-back");
      expect(html.match(/data-variant="subtle"/g)?.length ?? 0).toBe(
        sendBacks.length,
      );
      for (const action of sendBacks) {
        expect(html).toContain(action.label);
      }
      expect(html).not.toContain('disabled=""');
    },
  );

  it("disables every button while a request is pending", () => {
    const actions = stageActions("review");
    const html = renderToStaticMarkup(
      <StageActionButtons
        actions={actions}
        pending
        onSelect={() => undefined}
      />,
    );

    expect(html.match(/disabled=""/g)).toHaveLength(actions.length);
    expect(html).toContain("Move to Approved");
    expect(html).toContain("Send back to Analysis");
  });
});

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { workStage } from "@/db/schema";

import {
  STAGE_SEND_BACKS,
  WORK_STAGE_ORDER,
  allowedStageTargets,
  isAllowedStageTransition,
  nextStage,
} from "./workflow";

describe("stage transitions", () => {
  it("follows the work_stage enum and does not import the database", () => {
    expect([...WORK_STAGE_ORDER]).toEqual([...workStage.enumValues]);

    const source = readFileSync(
      new URL("./workflow.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/@\/db/);
    expect(source).not.toMatch(/server-only/);
    expect(source).not.toMatch(/drizzle-orm/);
  });

  it("allows one step forward and the two rework send-backs", () => {
    expect(allowedStageTargets("discovered")).toEqual(["repair_defined"]);
    expect(allowedStageTargets("repair_defined")).toEqual(["analysis"]);
    expect(allowedStageTargets("analysis")).toEqual([
      "review",
      "repair_defined",
    ]);
    expect(allowedStageTargets("review")).toEqual(["approved", "analysis"]);
    expect(allowedStageTargets("approved")).toEqual(["closed"]);
    expect(allowedStageTargets("closed")).toEqual([]);

    expect(isAllowedStageTransition("review", "analysis")).toBe(true);
    expect(isAllowedStageTransition("analysis", "repair_defined")).toBe(true);
    expect(nextStage("approved")).toBe("closed");
    expect(nextStage("closed")).toBeNull();
  });

  it("rejects same-stage, skipped stages, and leaving closed", () => {
    expect(isAllowedStageTransition("discovered", "discovered")).toBe(false);
    expect(isAllowedStageTransition("analysis", "analysis")).toBe(false);
    expect(isAllowedStageTransition("discovered", "analysis")).toBe(false);
    expect(isAllowedStageTransition("discovered", "review")).toBe(false);
    expect(isAllowedStageTransition("discovered", "closed")).toBe(false);
    expect(isAllowedStageTransition("approved", "analysis")).toBe(false);
    expect(isAllowedStageTransition("approved", "review")).toBe(false);
    expect(isAllowedStageTransition("closed", "approved")).toBe(false);
    expect(isAllowedStageTransition("repair_defined", "discovered")).toBe(
      false,
    );

    for (const [from, targets] of Object.entries(STAGE_SEND_BACKS)) {
      for (const target of targets ?? []) {
        const current = from as (typeof WORK_STAGE_ORDER)[number];
        expect(target).not.toBe(nextStage(current));
        expect(WORK_STAGE_ORDER.indexOf(target)).toBeLessThan(
          WORK_STAGE_ORDER.indexOf(current),
        );
      }
    }
  });
});

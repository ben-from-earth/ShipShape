import { describe, expect, it } from "vitest";

import { ANALYSIS_TRANSITIONS, canPerform } from "@/schemas";

import { canAttempt, movesFrom } from "./board";

const ada = "10000000-0000-4000-8000-000000000071";
const ren = "10000000-0000-4000-8000-000000000072";

describe("analysis transitions", () => {
  it("uses the shared table and limits start and submit to the assignee", () => {
    expect(ANALYSIS_TRANSITIONS.start.assignedAnalyst).toBe(true);
    expect(ANALYSIS_TRANSITIONS.submit.assignedAnalyst).toBe(true);
    expect(canPerform("reviewer", "start")).toBe(true);
    expect(canAttempt("reviewer", "start", ren, ada)).toBe(false);
    expect(canAttempt("analyst", "start", ada, ada)).toBe(true);
    expect(canAttempt("reviewer", "approve", ren, ada)).toBe(false);
    expect(canAttempt("reviewer", "send_back", ren, ada)).toBe(true);
    expect(movesFrom("in_review")).toEqual(["send_back", "approve"]);
  });
});

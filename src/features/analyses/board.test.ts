import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { canPerform, transitionsFrom } from "./board";

describe("analysis transitions", () => {
  it("lets a reviewer pick up and send back, and only an approver approve", () => {
    expect(canPerform("analyst", "start")).toBe(true);
    expect(canPerform("analyst", "pick_up")).toBe(false);
    expect(canPerform("reviewer", "pick_up")).toBe(true);
    expect(canPerform("reviewer", "approve")).toBe(false);
    expect(canPerform("approver", "approve")).toBe(true);
    expect(transitionsFrom("in_review").map((item) => item.action)).toEqual([
      "send_back",
      "approve",
    ]);
  });

  it("marks the transition table to import from @/schemas", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "board.ts"),
      "utf8",
    );
    expect(source).toContain(
      "import `{ ANALYSIS_TRANSITIONS, canPerform }` from `@/schemas`",
    );
    expect(source).toContain("x-engineer-id");
  });
});

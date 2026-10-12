import { describe, expect, it } from "vitest";

import { listAnalyses } from "./data";

describe("listAnalyses", () => {
  it("returns a promise the page can await", async () => {
    const pending = listAnalyses();
    expect(pending).toBeInstanceOf(Promise);

    const records = await pending;
    expect(records).toHaveLength(9);
    expect(records[0]?.id).toBe("SA-26-114");
  });
});

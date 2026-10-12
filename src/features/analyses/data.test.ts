import { describe, expect, it } from "vitest";

import { listAnalyses as listFromPage } from "./data";
import { listAnalyses as listFromDb } from "./db";
import { listAnalyses } from "./demo";

describe("listAnalyses", () => {
  it("returns a promise the page can await", async () => {
    const pending = listAnalyses();
    expect(pending).toBeInstanceOf(Promise);

    const records = await pending;
    expect(records).toHaveLength(9);
    expect(records[0]?.id).toBe("SA-26-114");
  });

  it("serves the database reader from the page module", () => {
    expect(listFromPage).toBe(listFromDb);
  });
});

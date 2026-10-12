import { describe, expect, it } from "vitest";

import { LOW_MARGIN_THRESHOLD } from "@/config/analysis";
import { DEMO_AS_OF } from "@/config/demo";

import {
  getAnalysesPage as pageFromData,
  listAnalyses as listFromPage,
} from "./data";
import { getAnalysesPage, listAnalyses as listFromDb } from "./db";
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
    expect(pageFromData).toBe(getAnalysesPage);
  });

  it("uses the fixture day when no database is configured", async () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
    const page = await getAnalysesPage();
    expect(page.asOf).toBe(DEMO_AS_OF);
    expect(page.marginThreshold).toBe(LOW_MARGIN_THRESHOLD);
    expect(page.records[0]?.id).toBe("SA-26-114");
  });
});

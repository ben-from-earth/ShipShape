import { describe, expect, it } from "vitest";

import { DEMO_AS_OF } from "@/config/demo";
import { classifyMargin } from "@/lib/margin";

import {
  agingNote,
  buildPipeline,
  countByAge,
  countByStage,
  countByZone,
  engineerRows,
  itemAgeDays,
  itemsNeedingAttention,
} from "./derive";
import { ENGINEERS, OPEN_ITEMS, STAGE_META } from "./fixtures";

describe("open item age", () => {
  it("counts whole days from discovery to the as-of date", () => {
    expect(itemAgeDays("2026-09-26", DEMO_AS_OF)).toBe(10);
    expect(itemAgeDays(DEMO_AS_OF, DEMO_AS_OF)).toBe(0);
  });

  it("buckets the demo program into the four age bands", () => {
    expect(
      countByAge(OPEN_ITEMS, DEMO_AS_OF).map((bucket) => bucket.count),
    ).toEqual([18, 13, 11, 5]);
  });

  it("mentions how many old items are waiting on a supplier", () => {
    expect(agingNote(OPEN_ITEMS, DEMO_AS_OF)).toBe(
      "5 items older than 30 days — 3 are waiting on supplier repair data.",
    );
  });
});

describe("stage and zone counts", () => {
  it("counts open items by stage", () => {
    expect(countByStage(OPEN_ITEMS)).toEqual({
      issue: 14,
      repair: 12,
      analyze: 12,
      approve: 9,
    });
    expect(OPEN_ITEMS).toHaveLength(47);
  });

  it("builds pipeline shares from median days and highlights the busiest zone", () => {
    const pipeline = buildPipeline(OPEN_ITEMS, STAGE_META);
    expect(pipeline.map((stage) => stage.count)).toEqual([14, 12, 12, 9]);
    expect(pipeline.reduce((sum, stage) => sum + stage.share, 0)).toBeCloseTo(
      1,
    );

    const zones = countByZone(OPEN_ITEMS);
    expect(zones.map((zone) => [zone.name, zone.count])).toEqual([
      ["Aft fuselage", 11],
      ["Tail", 9],
      ["Wings", 8],
      ["Canopy, frames 5–13", 7],
      ["Forward fuselage", 5],
      ["Intakes", 4],
      ["Landing gear", 3],
    ]);
    expect(zones[0]?.highlighted).toBe(true);
    expect(zones[1]?.highlighted).toBe(false);
  });
});

describe("items needing attention", () => {
  it("keeps the demo order and classifies margins with the shared threshold", () => {
    const rows = itemsNeedingAttention(OPEN_ITEMS);

    expect(rows.map((row) => row.id)).toEqual([
      "SA-26-109",
      "IS-26-212",
      "RD-0462",
      "SA-26-105",
      "SA-26-117",
    ]);
    expect(rows[0]?.stageLabel).toBe("Analyze · Rework");
    expect(classifyMargin(rows[0]?.margin)).toBe("negative");
    expect(classifyMargin(rows[3]?.margin)).toBe("low");
    expect(classifyMargin(rows[4]?.margin)).toBe("low");
    expect(rows[1]?.owner).toBe("Unassigned");
    expect(rows[1]?.margin).toBeNull();
  });
});

describe("engineerRows", () => {
  it("turns a load of 6 or more red and draws the authority queue as one bar", () => {
    const rows = engineerRows(ENGINEERS);
    const morales = rows.find((row) => row.initials === "JM");
    const authority = rows.find((row) => row.initials === "DL");

    expect(morales).toMatchObject({
      total: 6,
      totalTone: "bad",
      analystShare: 0.5,
      checkerShare: 0.25,
    });
    expect(authority).toMatchObject({
      total: 9,
      totalTone: "neutral",
      analystShare: 1,
      checkerShare: 0,
    });
  });
});

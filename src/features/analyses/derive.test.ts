import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEMO_AS_OF } from "@/config/demo";
import { classifyMargin } from "@/lib/margin";

import {
  dueLabel,
  filterAnalyses,
  lifecycleSteps,
  minMargin,
  ownerLine,
  peopleFor,
  sortAnalyses,
  statusCounts,
} from "./derive";
import { ANALYSES } from "./fixtures";

function walk(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walk(path));
    } else if (/\.(ts|tsx|css)$/.test(entry) && !/\.test\./.test(entry)) {
      files.push(path);
    }
  }

  return files;
}

describe("minMargin", () => {
  it("returns the lowest case margin, or null when nothing has been run", () => {
    const rework = ANALYSES.find((record) => record.id === "SA-26-109");
    const draft = ANALYSES.find((record) => record.id === "SA-26-120");

    expect(minMargin(rework?.cases ?? [])).toBe(-0.06);
    expect(classifyMargin(minMargin(rework?.cases ?? []))).toBe("negative");
    expect(minMargin(draft?.cases ?? [])).toBeNull();
    expect(
      classifyMargin(
        minMargin(
          ANALYSES.find((record) => record.id === "SA-26-105")?.cases ?? [],
        ),
      ),
    ).toBe("low");
  });
});

describe("filterAnalyses", () => {
  it("filters by status and by identifier, title, or zone", () => {
    expect(statusCounts(ANALYSES)).toMatchObject({
      all: 9,
      draft: 1,
      work: 2,
      check: 2,
      rework: 1,
      ready: 2,
      done: 1,
    });

    expect(
      filterAnalyses(ANALYSES, "check", "").map((record) => record.id),
    ).toEqual(["SA-26-114", "SA-26-111"]);
    expect(
      filterAnalyses(ANALYSES, "all", "165477").map((record) => record.id),
    ).toEqual(["SA-26-109", "SA-26-105"]);
    expect(
      filterAnalyses(ANALYSES, "work", "keel").map((record) => record.id),
    ).toEqual(["SA-26-117"]);
    expect(filterAnalyses(ANALYSES, "done", "165477")).toEqual([]);
  });
});

describe("sortAnalyses", () => {
  it("sorts by lowest margin, with missing margins last", () => {
    expect(sortAnalyses(ANALYSES, "margin").map((record) => record.id)).toEqual(
      [
        "SA-26-109",
        "SA-26-117",
        "SA-26-105",
        "SA-26-111",
        "SA-26-118",
        "SA-26-114",
        "SA-26-102",
        "SA-26-098",
        "SA-26-120",
      ],
    );
  });

  it("puts overdue work ahead of later due dates", () => {
    const sorted = sortAnalyses(ANALYSES, "due", DEMO_AS_OF);
    expect(sorted[0]?.id).toBe("SA-26-109");
    expect(dueLabel(sorted[0]!, DEMO_AS_OF)).toBe("Overdue");
    expect(
      dueLabel(ANALYSES.find((record) => record.id === "SA-26-098")!),
    ).toBe("Closed Sep 24");
  });
});

describe("lifecycle and people", () => {
  it("sends a rework back to repair and turns a finished analysis green", () => {
    expect(lifecycleSteps("rework").map((step) => step.state)).toEqual([
      "done",
      "rework",
      "todo",
      "todo",
    ]);
    expect(lifecycleSteps("check").map((step) => step.state)).toEqual([
      "done",
      "done",
      "current",
      "todo",
    ]);
    expect(
      lifecycleSteps("done").every((step) => step.state === "complete"),
    ).toBe(true);
  });

  it("names the checker on a record that is in check", () => {
    const inCheck = ANALYSES.find((record) => record.id === "SA-26-114");
    const rework = ANALYSES.find((record) => record.id === "SA-26-109");
    expect(inCheck).toBeDefined();
    expect(rework).toBeDefined();
    if (!inCheck || !rework) {
      return;
    }

    expect(ownerLine(inCheck)).toBe("J. Morales → A. Kowalski");
    expect(peopleFor(rework).map((person) => person.state)).toEqual([
      "Revising",
      "Flagged",
      "Waiting",
    ]);
    expect(peopleFor(inCheck)[2]?.tone).toBe("faint");
  });
});

describe("retired ambers", () => {
  it("does not reintroduce the dropped amber hexes", () => {
    const files = [
      ...walk("src/features"),
      ...walk("src/components/dashboard"),
      ...walk("src/components/analyses"),
    ];
    const banned = ["#a8761a", "#b08a2e", "#d9a21b"];

    for (const file of files) {
      const source = readFileSync(file, "utf8").toLowerCase();
      for (const hex of banned) {
        expect(source, file).not.toContain(hex);
      }
    }
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SEVERITIES, type Severity } from "./severity";

describe("SEVERITIES", () => {
  it("lists the four issue severities and imports nothing", () => {
    expect(SEVERITIES).toEqual(["low", "medium", "high", "critical"]);

    const sample: Severity = "critical";
    expect(SEVERITIES).toContain(sample);

    const source = readFileSync(
      path.join(process.cwd(), "src/config/severity.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).toContain(
      'export const SEVERITIES = ["low", "medium", "high", "critical"] as const;',
    );
    expect(source).toContain(
      "export type Severity = (typeof SEVERITIES)[number];",
    );
  });
});

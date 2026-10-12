import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { LOW_MARGIN_THRESHOLD } from "@/config/analysis";
import { classifyMargin, formatMargin, marginColor } from "@/lib/margin";

describe("LOW_MARGIN_THRESHOLD", () => {
  it("is the 0.10 fallback", () => {
    expect(LOW_MARGIN_THRESHOLD).toBe(0.1);
  });
});

describe("classifyMargin", () => {
  it("treats every negative margin as critical", () => {
    expect(classifyMargin(-0.01)).toBe("negative");
    expect(classifyMargin(-1)).toBe("negative");
    expect(classifyMargin(-0.01, -1)).toBe("negative");
  });

  it("marks zero up to the threshold as low and the threshold itself as ok", () => {
    expect(classifyMargin(0)).toBe("low");
    expect(classifyMargin(0.09)).toBe("low");
    expect(classifyMargin(0.099)).toBe("low");
    expect(classifyMargin(LOW_MARGIN_THRESHOLD)).toBe("ok");
    expect(classifyMargin(0.25)).toBe("ok");
  });

  it("uses a caller-supplied threshold without recoloring negatives", () => {
    expect(classifyMargin(0.12, 0.25)).toBe("low");
    expect(classifyMargin(0.25, 0.25)).toBe("ok");
    expect(classifyMargin(-0.02, 0.25)).toBe("negative");
  });

  it("treats null, undefined, and NaN as missing", () => {
    expect(classifyMargin(null)).toBe("missing");
    expect(classifyMargin(undefined)).toBe("missing");
    expect(classifyMargin(Number.NaN)).toBe("missing");
  });
});

describe("formatMargin", () => {
  it("prints a signed value with a unicode minus", () => {
    expect(formatMargin(0.18)).toBe("+0.18");
    expect(formatMargin(0)).toBe("+0.00");
    expect(formatMargin(-0.06)).toBe("\u22120.06");
    expect(formatMargin(-0.06).includes("-")).toBe(false);
  });

  it("prints an em dash when the margin is missing", () => {
    expect(formatMargin(null)).toBe("\u2014");
    expect(formatMargin(undefined)).toBe("\u2014");
    expect(formatMargin(Number.NaN)).toBe("\u2014");
  });
});

describe("marginColor", () => {
  it("uses red, the single amber, green, and faint ink", () => {
    expect(marginColor(-0.06)).toBe("#c8361f");
    expect(marginColor(0.04)).toBe("#b07d0e");
    expect(marginColor(0.1)).toBe("#2f5d50");
    expect(marginColor(null)).toBe("#8a8f98");
  });
});

describe("theme amber", () => {
  it("keeps a single warning amber in the stylesheet", () => {
    const cssPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../app/globals.css",
    );
    const css = readFileSync(cssPath, "utf8");

    expect(css).toContain("#b07d0e");
    expect(css).toContain("#f3f2ee");
    expect(css).toContain("#15181d");
    expect(css).toContain("#1e2d55");
    expect(css).toContain("#c8361f");
    expect(css).toContain("--radius: 0px");
    expect(css).not.toContain("#a8761a");
    expect(css).not.toContain("#b08a2e");
    expect(css).not.toContain("#d9a21b");
  });
});

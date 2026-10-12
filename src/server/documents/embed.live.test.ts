import { describe, expect, it } from "vitest";

import { DOCUMENT_EMBEDDING_DIMENSIONS } from "@/schemas";

const enabled = process.env.RUN_EMBEDDING_MODEL === "1";

describe.skipIf(!enabled)("embed with the local model", () => {
  it("returns one normalized 384-dimension vector", async () => {
    const { embedText } = await import("./embed");
    const vector = await embedText("bent support near the access hatch");
    const norm = Math.hypot(...vector);

    expect(vector).toHaveLength(DOCUMENT_EMBEDDING_DIMENSIONS);
    expect(norm).toBeCloseTo(1, 5);
  }, 180_000);
});

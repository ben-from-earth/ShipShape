import { describe, expect, it } from "vitest";

import { throughputBuckets } from "./periods";

const AS_OF = "2026-10-06";

describe("throughputBuckets", () => {
  it("builds twelve weekly buckets that contain the as-of instant", () => {
    const buckets = throughputBuckets("30D", AS_OF);
    const last = buckets[11];

    expect(buckets).toHaveLength(12);
    expect(last?.label.startsWith("W")).toBe(true);
    expect(last && "2026-10-06T12:00:00.000Z" >= last.start).toBe(true);
    expect(last && "2026-10-06T12:00:00.000Z" < last.end).toBe(true);
    expect(last && "2026-10-05T00:00:00.000Z" >= last.start).toBe(true);
    expect(buckets[10] && "2026-10-04T12:00:00.000Z" < buckets[10].end).toBe(
      true,
    );
  });

  it("labels the first bi-weekly bucket of each month and leaves the rest blank", () => {
    const buckets = throughputBuckets("90D", AS_OF);

    expect(buckets).toHaveLength(12);
    expect(buckets.some((bucket) => bucket.label === "")).toBe(true);
    expect(buckets.some((bucket) => bucket.label === "Sep")).toBe(true);
  });

  it("covers the trailing twelve calendar months", () => {
    const buckets = throughputBuckets("12M", AS_OF);

    expect(buckets.map((bucket) => bucket.label)).toEqual([
      "N",
      "D",
      "J",
      "F",
      "M",
      "A",
      "M",
      "J",
      "J",
      "A",
      "S",
      "O",
    ]);
  });
});

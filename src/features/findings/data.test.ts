import { describe, expect, it } from "vitest";

import { getFinding, getFindingMedia, listFindings } from "./data";
import {
  getFinding as getFromDb,
  getFindingMedia as getMediaFromDb,
  listFindings as listFromDb,
} from "./db";

const DEMO_FINDING_ID = "10000000-0000-4000-8000-000000000031";
const DEMO_MEDIA_ID = "10000000-0000-4000-8000-000000000032";
const DEMO_ASSET_ID = "10000000-0000-4000-8000-000000000022";
const OTHER_ID = "10000000-0000-4000-8000-000000000099";

describe("finding readers", () => {
  it("returns the demo finding when no database is configured", async () => {
    expect(process.env.DATABASE_URL).toBeUndefined();

    const pending = listFindings();
    expect(pending).toBeInstanceOf(Promise);

    const records = await pending;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: DEMO_FINDING_ID,
      code: "ISS-1001",
      assetId: DEMO_ASSET_ID,
      severity: "high",
      stage: "discovered",
      zone: "canopy",
      locationLabel: "LH canopy sill",
    });
    expect(records[0]).not.toHaveProperty("title");
    expect(records[0]).not.toHaveProperty("notes");
    expect(records[0]?.photos[0]).toMatchObject({
      mediaId: DEMO_MEDIA_ID,
      contentType: "image/jpeg",
      size: null,
      storageKey: "demo/issues/ISS-1001/sill.jpg",
    });
    expect(records[0]?.photos[0]).not.toHaveProperty("url");

    expect(await getFinding(DEMO_FINDING_ID)).toEqual(records[0]);
    expect(await getFinding(OTHER_ID)).toBeNull();
    expect(await getFinding("not-a-uuid")).toBeNull();
    expect(await getFindingMedia(DEMO_FINDING_ID, DEMO_MEDIA_ID)).toEqual({
      storageKey: "demo/issues/ISS-1001/sill.jpg",
      contentType: "image/jpeg",
      size: null,
    });
    expect(await getFindingMedia(DEMO_FINDING_ID, OTHER_ID)).toBeNull();
    expect(await getFindingMedia(OTHER_ID, DEMO_MEDIA_ID)).toBeNull();
  });

  it("applies stage, severity, and asset filters to the fixture", async () => {
    expect(await listFindings({ severity: "low" })).toEqual([]);
    expect(await listFindings({ stage: "analysis" })).toEqual([]);
    expect(await listFindings({ assetId: OTHER_ID })).toEqual([]);
    expect(
      await listFindings({
        stage: "discovered",
        severity: "high",
        assetId: DEMO_ASSET_ID,
      }),
    ).toHaveLength(1);
  });

  it("serves the database reader from the page module", () => {
    expect(listFindings).toBe(listFromDb);
    expect(getFinding).toBe(getFromDb);
    expect(getFindingMedia).toBe(getMediaFromDb);
  });
});

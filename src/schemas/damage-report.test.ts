import { describe, expect, it } from "vitest";

import { damageReportCreateSchema } from "@/schemas";

const validReport = {
  assetId: "asset-17",
  summary: "Bent support near the access hatch",
  description: "The support is visibly deformed. Photos are attached.",
  reportedBy: "Field technician",
  photos: [
    {
      storageKey: "damage/2026/10/asset-17.jpg",
      contentType: "image/jpeg",
    },
  ],
};

describe("damageReportCreateSchema", () => {
  it("requires a damage report to include a photo", () => {
    const parsed = damageReportCreateSchema.parse(validReport);

    expect(parsed.photos).toHaveLength(1);
    expect(parsed.summary).toBe("Bent support near the access hatch");

    const missingPhoto = damageReportCreateSchema.safeParse({
      ...validReport,
      photos: [],
    });

    expect(missingPhoto.success).toBe(false);
  });
});

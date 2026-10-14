import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { FindingDetail } from "@/components/findings/finding-detail";
import type { FindingRecord, Repair } from "@/schemas";

import { RepairDetail } from "./repair-detail";
import { RepairsList } from "./repairs-list";

const createdAt = "2026-10-06T12:00:00.000Z";

function repair(name: string | null, identifier = "A-0022"): Repair {
  return {
    id: "550e8400-e29b-41d4-a716-446655440041",
    code: "REP-1001",
    findingId: "550e8400-e29b-41d4-a716-446655440031",
    title: "Replace the seal",
    type: "patch",
    status: "open",
    createdBy: null,
    createdAt,
    updatedAt: createdAt,
    finding: {
      id: "550e8400-e29b-41d4-a716-446655440031",
      code: "ISS-1001",
    },
    asset: {
      id: "550e8400-e29b-41d4-a716-446655440022",
      identifier,
      name,
    },
  };
}

const finding: FindingRecord = {
  id: "550e8400-e29b-41d4-a716-446655440031",
  code: "ISS-1001",
  assetId: "550e8400-e29b-41d4-a716-446655440022",
  description: "A crack along the joint.",
  severity: "high",
  stage: "discovered",
  zone: null,
  locationLabel: null,
  location: null,
  createdAt,
  asset: {
    id: "550e8400-e29b-41d4-a716-446655440022",
    identifier: "A-0022",
    name: "Fitting",
    assetGroup: {
      id: "550e8400-e29b-41d4-a716-446655440021",
      name: "Group",
    },
  },
  photos: [],
};

describe("repair asset label on the pages", () => {
  it("shows the asset name on the list, the detail, and the finding's repairs", () => {
    const named = repair("Fitting");
    const list = renderToStaticMarkup(
      <RepairsList records={[named]} filters={{}} />,
    );
    const detail = renderToStaticMarkup(<RepairDetail record={named} />);
    const onFinding = renderToStaticMarkup(
      <FindingDetail record={finding} repairs={[named]} />,
    );

    for (const html of [list, detail]) {
      expect(html).toContain("Fitting");
      expect(html).not.toContain("A-0022 · Fitting");
    }
    expect(detail).not.toContain("Create analysis");
    expect(onFinding).toContain("Fitting");
    expect(onFinding).toContain("Replace the seal");
    expect(list).toContain("ISS-1001");
    expect(detail).toContain("ISS-1001");
  });

  it("shows the identifier when the asset has no name", () => {
    const unnamed = repair(null, "A-0099");
    const list = renderToStaticMarkup(
      <RepairsList records={[unnamed]} filters={{}} />,
    );
    const detail = renderToStaticMarkup(<RepairDetail record={unnamed} />);
    const onFinding = renderToStaticMarkup(
      <FindingDetail record={finding} repairs={[unnamed]} />,
    );

    for (const html of [list, detail, onFinding]) {
      expect(html).toContain("A-0099");
    }
  });
});

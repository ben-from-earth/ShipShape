import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import type { ReviewHistory } from "@/features/analyses/review-history";

import { ReviewPanel } from "./review-panel";

const analysisId = "10000000-0000-4000-8000-000000000051";

const history: ReviewHistory = {
  id: "10000000-0000-4000-8000-000000000054",
  analysisId,
  decision: "pending",
  comment: "Recheck the sill.",
  createdAt: "2026-10-06T12:00:00.000Z",
};

describe("ReviewPanel", () => {
  it("shows submit for review while the analysis is still with the author", () => {
    const html = renderToStaticMarkup(
      <ReviewPanel analysisId={analysisId} status="draft" reviews={[]} />,
    );

    expect(html).toContain("Submit for review");
    expect(html).toContain("No reviews yet.");
    expect(html).not.toContain('name="decision"');
    expect(html).not.toContain("Save review");
  });

  it("shows the decision form and history while a review is open", () => {
    const html = renderToStaticMarkup(
      <ReviewPanel
        analysisId={analysisId}
        status="in_review"
        reviews={[history]}
      />,
    );

    expect(html).toContain("Approved");
    expect(html).toContain("Changes requested");
    expect(html).toContain("Save review");
    expect(html).toContain('id="review-comment"');
    expect(html).toContain("required");
    expect(html).toContain("Recheck the sill.");
    expect(html).toContain("Pending");
    expect(html).toContain("bg-warn");
    expect(html).not.toContain("Submit for review");
  });

  it("shows history without an action once the analysis is approved", () => {
    const html = renderToStaticMarkup(
      <ReviewPanel
        analysisId={analysisId}
        status="approved"
        reviews={[
          { ...history, decision: "approved", comment: "Looks sound." },
        ]}
      />,
    );

    expect(html).toContain("Looks sound.");
    expect(html).not.toContain("Submit for review");
    expect(html).not.toContain("Save review");
  });
});

import { documentSearchHitSchema } from "@/schemas";
import type { DocumentSearchHit } from "@/schemas";

/**
 * Demo passages for Intelli-Search until the search route exists.
 * T-45 wording here is fixture content. Chrome stays domain-agnostic.
 */
const DEMO_HITS: readonly DocumentSearchHit[] = [
  {
    documentId: "550e8400-e29b-41d4-a716-446655440001",
    documentTitle: "Hull inspection notes",
    snippet: "Bent support near the access hatch.",
    score: 0.86,
    chunk: {
      index: 0,
      text: "Bent support near the access hatch. Blend the edge smooth and reinspect before the next use.",
      startOffset: 0,
      endOffset: 96,
      pageStart: 4,
      pageEnd: 4,
    },
  },
  {
    documentId: "550e8400-e29b-41d4-a716-446655440002",
    documentTitle: "Actuator seal check",
    snippet:
      "Seepage at the actuator gland is acceptable up to 2 drops per minute.",
    score: 0.81,
    chunk: {
      index: 2,
      text: "Seepage at the actuator gland is acceptable up to 2 drops per minute with the system pressurized. Replace the seal kit when the limit is exceeded.",
      startOffset: 420,
      endOffset: 564,
      pageStart: 7,
      pageEnd: 7,
    },
  },
  {
    documentId: "550e8400-e29b-41d4-a716-446655440003",
    documentTitle: "T-45 Goshawk joint inspection",
    snippet:
      "A hairline crack near a joint is acceptable when it does not start at a fastener hole.",
    score: 0.78,
    chunk: {
      index: 1,
      text: "A hairline crack near a joint is acceptable up to 0.25 in when it does not start at a fastener hole. Stop-drill and reinspect on the next interval.",
      startOffset: 180,
      endOffset: 334,
      pageStart: 11,
      pageEnd: 12,
    },
  },
  {
    documentId: "550e8400-e29b-41d4-a716-446655440004",
    documentTitle: "Splice corrosion repair",
    snippet:
      "Blend corrosion at a splice to a smooth contour, then treat the bare surface.",
    score: 0.74,
    chunk: {
      index: 0,
      text: "Blend corrosion at a splice to a smooth contour not exceeding the published depth. Treat the bare surface and record the blend.",
      startOffset: 0,
      endOffset: 132,
      pageStart: null,
      pageEnd: null,
    },
  },
];

export const DEMO_SEARCH_HITS: readonly DocumentSearchHit[] = DEMO_HITS.map(
  (hit) => documentSearchHitSchema.parse(hit),
);

export const SEARCH_EXAMPLES = [
  "hairline crack near a joint",
  "seepage at a seal",
  "corrosion at a splice",
  "bent support",
] as const;

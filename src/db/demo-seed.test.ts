import { describe, expect, it } from "vitest";

import { documentChunkSchema } from "@/schemas";

import {
  demoAnalysisPeople,
  demoAsset,
  demoAssetGroup,
  demoDocumentChunk,
  demoEmbedding,
  DEMO_ENGINEER_PASSWORD,
  demoEngineers,
  demoIds,
  demoIssue,
  demoUsers,
} from "./demo-seed";
import { DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS } from "./schema";

describe("demo seed", () => {
  it("includes one T-45 asset group as sample data", () => {
    expect(demoAssetGroup.name).toBe("T-45 Goshawk");
    expect(demoAssetGroup.assetType).toBe("aircraft");
    expect(demoAsset.groupId).toBe(demoAssetGroup.id);
    expect(demoAsset.orgId).toBe(demoIds.organization);
    expect(demoAsset.outOfService).toBe(false);
    expect(demoIssue.assetId).toBe(demoAsset.id);
    expect(demoIssue.severity).toBe("high");
    expect(demoDocumentChunk.pageStart).toBe(1);
    expect(demoDocumentChunk.pageEnd).toBe(1);
    expect(demoDocumentChunk.startOffset).toBe(0);
    expect(demoDocumentChunk.endOffset).toBe(demoDocumentChunk.text.length);
    expect(demoUsers).toHaveLength(4);
    expect(demoEngineers.map((engineer) => engineer.email)).toEqual([
      "analyst@example.com",
      "reviewer@example.com",
      "approver@example.com",
    ]);
    expect(demoEngineers.map((engineer) => engineer.role)).toEqual([
      "analyst",
      "reviewer",
      "approver",
    ]);
    expect(DEMO_ENGINEER_PASSWORD).toBe("dev-password");
    expect(demoAnalysisPeople.map((person) => person.role).sort()).toEqual([
      "analyst",
      "approver",
      "checker",
    ]);
  });

  it("matches the chunker document chunk shape", () => {
    expect(
      documentChunkSchema.parse({
        index: demoDocumentChunk.index,
        text: demoDocumentChunk.text,
        startOffset: demoDocumentChunk.startOffset,
        endOffset: demoDocumentChunk.endOffset,
        pageStart: demoDocumentChunk.pageStart,
        pageEnd: demoDocumentChunk.pageEnd,
      }),
    ).toMatchObject({
      index: 0,
      pageStart: 1,
      pageEnd: 1,
    });
  });

  it("stores a normalized 384-dimension stand-in embedding", () => {
    const embedding = demoEmbedding();

    expect(embedding).toHaveLength(DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS);
    expect(demoDocumentChunk.embedding).toEqual(embedding);
    expect(Math.hypot(...embedding)).toBeCloseTo(1);
  });
});

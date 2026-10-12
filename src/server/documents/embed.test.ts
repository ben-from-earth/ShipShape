import { beforeEach, describe, expect, it, vi } from "vitest";

import { DOCUMENT_EMBEDDING_DIMENSIONS } from "@/schemas";

const { extractorMock, pipelineMock } = vi.hoisted(() => {
  const extractorMock = vi.fn(async (texts: string[]) => ({
    tolist: () => texts.map(() => Array.from({ length: 384 }, () => 0.25)),
  }));
  const pipelineMock = vi.fn(async () => extractorMock);
  return { extractorMock, pipelineMock };
});

vi.mock("@huggingface/transformers", () => ({
  pipeline: pipelineMock,
}));

async function loadEmbed() {
  return import("./embed");
}

beforeEach(() => {
  vi.resetModules();
  pipelineMock.mockReset();
  extractorMock.mockReset();
  pipelineMock.mockImplementation(async () => extractorMock);
  extractorMock.mockImplementation(async (texts: string[]) => ({
    tolist: () => texts.map(() => Array.from({ length: 384 }, () => 0.25)),
  }));
});

describe("embed", () => {
  it("does not load the model for an empty batch", async () => {
    const { embed } = await loadEmbed();

    await expect(embed([])).resolves.toEqual([]);
    expect(pipelineMock).not.toHaveBeenCalled();
  });

  it("loads Xenova/all-MiniLM-L6-v2 once and mean-pools normalized vectors", async () => {
    const { embed, embedText } = await loadEmbed();

    const batch = await embed(["alpha", "beta"]);
    const single = await embedText("gamma");

    expect(pipelineMock).toHaveBeenCalledTimes(1);
    expect(pipelineMock).toHaveBeenCalledWith(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
    );
    expect(extractorMock).toHaveBeenNthCalledWith(1, ["alpha", "beta"], {
      pooling: "mean",
      normalize: true,
    });
    expect(extractorMock).toHaveBeenNthCalledWith(2, ["gamma"], {
      pooling: "mean",
      normalize: true,
    });
    expect(batch).toHaveLength(2);
    expect(batch[0]).toHaveLength(DOCUMENT_EMBEDDING_DIMENSIONS);
    expect(single).toHaveLength(DOCUMENT_EMBEDDING_DIMENSIONS);
  });

  it("embeds long batches in more than one forward pass", async () => {
    const { embed } = await loadEmbed();
    const texts = Array.from({ length: 40 }, (_, index) => `chunk ${index}`);

    const vectors = await embed(texts);

    expect(vectors).toHaveLength(texts.length);
    expect(extractorMock.mock.calls.length).toBeGreaterThan(1);
    const seen = extractorMock.mock.calls.flatMap((call) => call[0] ?? []);
    expect(seen).toEqual(texts);
  });

  it("rejects a vector that is not 384 dimensions", async () => {
    extractorMock.mockImplementation(async () => ({
      tolist: () => [[1, 2, 3]],
    }));
    const { embed } = await loadEmbed();

    await expect(embed(["hatch"])).rejects.toThrow(/384/);
  });

  it("retries after the model fails to load", async () => {
    pipelineMock.mockRejectedValueOnce(new Error("network down"));
    const { embed } = await loadEmbed();

    await expect(embed(["hatch"])).rejects.toThrow(/network down/);
    await expect(embed(["hatch"])).resolves.toHaveLength(1);
    expect(pipelineMock).toHaveBeenCalledTimes(2);
  });
});

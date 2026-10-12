import "server-only";

import { DOCUMENT_EMBEDDING_DIMENSIONS } from "@/schemas";

/**
 * Local embeddings for contextual document search.
 *
 * This file is the only place that knows the model and the runtime.
 * Callers use embed() and embedText(). To swap providers, replace
 * loadExtractor() and keep returning DOCUMENT_EMBEDDING_DIMENSIONS
 * normalized numbers.
 */

/** Hugging Face id for all-MiniLM-L6-v2, mean-pooled and L2-normalized. */
const EMBEDDING_MODEL_ID = "Xenova/all-MiniLM-L6-v2";

/** Texts encoded per forward pass, so one document does not become one giant tensor. */
const EMBEDDING_BATCH_SIZE = 32;

type FeatureExtractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: true },
) => Promise<{ tolist: () => unknown }>;

let extractorPromise: Promise<FeatureExtractor> | undefined;

async function loadExtractor(): Promise<FeatureExtractor> {
  const { pipeline } = await import("@huggingface/transformers");
  const extractor = await pipeline("feature-extraction", EMBEDDING_MODEL_ID);

  return (texts, options) => extractor(texts, options);
}

function getExtractor(): Promise<FeatureExtractor> {
  extractorPromise ??= loadExtractor().catch((error: unknown) => {
    extractorPromise = undefined;
    throw error;
  });
  return extractorPromise;
}

function readVector(value: unknown, index: number): number[] {
  if (!Array.isArray(value)) {
    throw new Error(`Embedding ${index} was not a vector`);
  }

  if (value.length !== DOCUMENT_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding ${index} has length ${value.length}; expected ${DOCUMENT_EMBEDDING_DIMENSIONS}`,
    );
  }

  const numbers: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new Error(`Embedding ${index} contains a non-finite number`);
    }
    numbers.push(item);
  }

  return numbers;
}

function readVectors(raw: unknown, expectedCount: number): number[][] {
  if (!Array.isArray(raw) || raw.length !== expectedCount) {
    const actual = Array.isArray(raw) ? String(raw.length) : "a non-array";
    throw new Error(
      `Embedding model returned ${actual} vector(s) for ${expectedCount} input(s)`,
    );
  }

  return raw.map((vector, index) => readVector(vector, index));
}

/**
 * Embed every text. An empty list returns immediately and does not load the model.
 * Vectors are mean-pooled and L2-normalized.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const extractor = await getExtractor();
  const vectors: number[][] = [];

  for (let index = 0; index < texts.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(index, index + EMBEDDING_BATCH_SIZE);
    const output = await extractor(batch, {
      pooling: "mean",
      normalize: true,
    });
    vectors.push(...readVectors(output.tolist(), batch.length));
  }

  return vectors;
}

/** Embed a single text. */
export async function embedText(text: string): Promise<number[]> {
  const vectors = await embed([text]);
  const vector = vectors[0];
  if (vector === undefined) {
    throw new Error("Embedding model returned no vector");
  }
  return vector;
}

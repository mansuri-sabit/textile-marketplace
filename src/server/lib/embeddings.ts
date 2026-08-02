import { env, integrations } from "./env";

/**
 * Text embeddings for semantic product search.
 *
 * Hugging Face is primary because the brief states a preference for a custom
 * HF model. OpenAI is a fallback for one reason only: the HF free tier has a
 * monthly credit ceiling, and a demo that dies because the quota ran out is
 * worse than one that quietly changes provider. The two produce different
 * dimensions, so a provider switch requires re-seeding every embedding — the
 * dimension is recorded alongside the vector to make that mismatch detectable.
 */

export type EmbeddingResult = {
  vector: number[];
  provider: "huggingface" | "openai";
  dim: number;
};

const HF_ENDPOINT = "https://router.huggingface.co/hf-inference/models";

async function embedWithHuggingFace(text: string): Promise<number[]> {
  const e = env();
  const res = await fetch(
    `${HF_ENDPOINT}/${e.HF_EMBEDDING_MODEL}/pipeline/feature-extraction`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${e.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    },
  );

  if (!res.ok) {
    throw new Error(`HF ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }

  const raw = (await res.json()) as number[] | number[][];
  // Some models return a per-token matrix; mean-pool it down to one vector.
  if (Array.isArray(raw[0])) {
    const matrix = raw as number[][];
    const dim = matrix[0].length;
    const pooled = new Array<number>(dim).fill(0);
    for (const row of matrix) {
      for (let i = 0; i < dim; i++) pooled[i] += row[i];
    }
    return pooled.map((v) => v / matrix.length);
  }
  return raw as number[];
}

async function embedWithOpenAI(text: string): Promise<number[]> {
  const e = env();
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${e.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }

  const body = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return body.data[0].embedding;
}

export async function embed(text: string): Promise<EmbeddingResult> {
  const input = text.replace(/\s+/g, " ").trim().slice(0, 2000);

  if (integrations.huggingFace()) {
    try {
      const vector = await embedWithHuggingFace(input);
      return { vector, provider: "huggingface", dim: vector.length };
    } catch (err) {
      if (!integrations.openai()) throw err;
      console.warn(
        `  [embeddings] Hugging Face failed, falling back to OpenAI: ${(err as Error).message}`,
      );
    }
  }

  if (!integrations.openai()) {
    throw new Error("No embedding provider configured (set HF_TOKEN or OPENAI_API_KEY)");
  }

  const vector = await embedWithOpenAI(input);
  return { vector, provider: "openai", dim: vector.length };
}

/** Cosine similarity. Both vectors must come from the same provider. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

import { AppError } from "../lib/api";
import { connectDB } from "../lib/db";
import { cosineSimilarity, embed } from "../lib/embeddings";
import { integrations } from "../lib/env";
import { Product } from "../models";
import * as repo from "../repositories/product.repository";
import { sortSpec } from "../repositories/product.repository";
import type { ProductQuery } from "../validators/product";

/**
 * Embeddings are cached per isolate rather than re-read on every search.
 *
 * With a catalog this size an exact in-memory cosine scan is both simpler and
 * faster than a vector index, and it keeps the prototype free of Atlas Search
 * setup. The honest limit: this stops scaling somewhere in the low tens of
 * thousands of products, at which point this function is the thing to replace
 * with Atlas Vector Search — nothing above it needs to change.
 */
type EmbeddingRow = { id: string; vector: number[] };
let embeddingCache: { rows: EmbeddingRow[]; loadedAt: number } | null = null;
const EMBEDDING_TTL_MS = 5 * 60 * 1000;

async function getEmbeddings(): Promise<EmbeddingRow[]> {
  if (embeddingCache && Date.now() - embeddingCache.loadedAt < EMBEDDING_TTL_MS) {
    return embeddingCache.rows;
  }

  const docs = await repo.loadEmbeddings();
  const rows = docs
    .filter((d) => Array.isArray(d.embedding) && d.embedding.length > 0)
    .map((d) => ({ id: String(d._id), vector: d.embedding as number[] }));

  embeddingCache = { rows, loadedAt: Date.now() };
  return rows;
}

/** Called after any write that changes the catalog. */
export function invalidateEmbeddingCache() {
  embeddingCache = null;
}

export type SearchMode = "semantic" | "keyword" | "browse";

/**
 * Ranks the whole catalog against a natural-language query.
 * Returns null when semantic search is unavailable or the stored vectors were
 * produced by a different provider, so the caller can fall back to keywords.
 */
async function semanticRank(query: string): Promise<string[] | null> {
  if (!integrations.huggingFace() && !integrations.openai()) return null;

  try {
    const rows = await getEmbeddings();
    if (!rows.length) return null;

    const { vector } = await embed(query);
    if (vector.length !== rows[0].vector.length) {
      console.warn(
        `[search] embedding dimension mismatch: query ${vector.length} vs catalog ${rows[0].vector.length}. Re-seed to switch provider.`,
      );
      return null;
    }

    return rows
      .map((r) => ({ id: r.id, score: cosineSimilarity(vector, r.vector) }))
      // Below this the matches are noise and rank worse than a keyword hit.
      .filter((r) => r.score > 0.25)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.id);
  } catch (err) {
    console.warn(`[search] semantic ranking failed: ${(err as Error).message}`);
    return null;
  }
}

function keywordFilter(q: string) {
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(escaped, "i");
  return { $or: [{ name: rx }, { description: rx }, { tags: rx }, { category: rx }] };
}

export async function listProducts(query: ProductQuery) {
  await connectDB();

  const baseFilter = await repo.buildFilter(query);
  const skip = (query.page - 1) * query.limit;
  let mode: SearchMode = query.q ? "keyword" : "browse";

  if (query.q) {
    const ranked = await semanticRank(query.q);

    if (ranked?.length) {
      mode = "semantic";
      // Intersect the semantic ranking with the active filters, then paginate
      // the ranked list — the order has to survive the database round trip.
      const allowed = await Product.find({ ...baseFilter, _id: { $in: ranked } })
        .select("_id")
        .lean();
      const allowedIds = new Set(allowed.map((d) => String(d._id)));
      const ordered = ranked.filter((id) => allowedIds.has(id));

      const pageIds = ordered.slice(skip, skip + query.limit);
      const docs = await repo.findByIds(pageIds);
      const byId = new Map(docs.map((d) => [String(d._id), d]));

      return {
        mode,
        products: pageIds.map((id) => byId.get(id)).filter(Boolean),
        total: ordered.length,
        page: query.page,
        pages: Math.max(1, Math.ceil(ordered.length / query.limit)),
      };
    }

    Object.assign(baseFilter, keywordFilter(query.q));
  }

  const sort = sortSpec(query.sort, Boolean(query.q));
  const [products, total] = await Promise.all([
    repo.findProducts(baseFilter, { sort, skip, limit: query.limit }),
    repo.countProducts(baseFilter),
  ]);

  return {
    mode,
    products,
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getFacets(query: ProductQuery) {
  await connectDB();
  const filter = await repo.buildFilter(query);
  return repo.facetCounts(filter);
}

export async function getProductBySlug(slug: string) {
  await connectDB();
  const product = await repo.findBySlug(slug);
  if (!product) throw new AppError("NOT_FOUND", "That product does not exist.", 404);

  // Fire-and-forget: a view counter must never slow down or fail a page render.
  Product.updateOne({ slug }, { $inc: { viewCount: 1 } }).catch(() => {});

  return product;
}

/**
 * "Similar products", ranked by embedding proximity to the given product and
 * falling back to same-category when vectors are unavailable.
 */
export async function getSimilarProducts(slug: string, limit = 8) {
  await connectDB();

  const source = await Product.findOne({ slug }).select("+embedding category _id").lean();
  if (!source) throw new AppError("NOT_FOUND", "That product does not exist.", 404);

  const vector = source.embedding as number[] | undefined;

  if (vector?.length) {
    const rows = await getEmbeddings();
    const ranked = rows
      .filter((r) => r.id !== String(source._id) && r.vector.length === vector.length)
      .map((r) => ({ id: r.id, score: cosineSimilarity(vector, r.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (ranked.length) {
      const docs = await repo.findByIds(ranked.map((r) => r.id));
      const byId = new Map(docs.map((d) => [String(d._id), d]));
      return ranked.map((r) => byId.get(r.id)).filter(Boolean);
    }
  }

  return repo.findProducts(
    { category: source.category, _id: { $ne: source._id }, status: "active" },
    { sort: { rating: -1 }, skip: 0, limit },
  );
}

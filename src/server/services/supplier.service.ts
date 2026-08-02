import { Types } from "mongoose";
import { AppError } from "../lib/api";
import { connectDB } from "../lib/db";
import { embed } from "../lib/embeddings";
import { slugify } from "../lib/slug";
import { Product, SupplierProfile } from "../models";
import { invalidateEmbeddingCache } from "./product.service";
import type { ProductInput } from "../validators/product";

/**
 * Resolves the signed-in supplier user to their business profile.
 * Every supplier-scoped query keys off this id rather than the user id, so a
 * supplier can only ever read and write their own catalog and orders.
 */
export async function requireSupplierProfile(userId: string) {
  await connectDB();
  const profile = await SupplierProfile.findOne({ user: new Types.ObjectId(userId) })
    .select("_id businessName slug minimumOrderQuantity")
    .lean();

  if (!profile) {
    throw new AppError(
      "PROFILE_INCOMPLETE",
      "Finish setting up your business profile first.",
      409,
    );
  }
  return profile;
}

/**
 * Public supplier directory.
 *
 * A profile with nothing listed is a dead end for a buyer — the card would open
 * an empty catalog — so suppliers stay hidden here until they list their first
 * product. That matters now that onboarding can create profiles.
 */
export async function listSupplierDirectory() {
  await connectDB();

  const suppliers = await SupplierProfile.find()
    .select(
      "businessName slug businessType description logoUrl address categories verified rating ratingCount minimumOrderQuantity yearEstablished",
    )
    .sort({ verified: -1, rating: -1 })
    .lean();

  // One grouped count beats N per-supplier queries.
  const counts = await Product.aggregate<{ _id: unknown; count: number }>([
    { $match: { status: { $in: ["active", "out_of_stock"] } } },
    { $group: { _id: "$supplier", count: { $sum: 1 } } },
  ]);
  const countBySupplier = new Map(counts.map((c) => [String(c._id), c.count]));

  return suppliers
    .map((s) => ({ ...s, productCount: countBySupplier.get(String(s._id)) ?? 0 }))
    .filter((s) => s.productCount > 0);
}

/** Public storefront: the profile plus its live catalog. */
export async function getSupplierStorefront(slug: string) {
  await connectDB();

  const supplier = await SupplierProfile.findOne({ slug }).lean();
  if (!supplier) {
    throw new AppError("NOT_FOUND", "That supplier does not exist.", 404);
  }

  const [products, productCount] = await Promise.all([
    Product.find({
      supplier: supplier._id,
      status: { $in: ["active", "out_of_stock"] },
    })
      .select("name slug category images pricePerUnit unit stock status rating featured")
      .sort({ featured: -1, rating: -1 })
      .limit(24)
      .lean(),
    Product.countDocuments({ supplier: supplier._id }),
  ]);

  return { supplier, products, productCount };
}

/** Slugs must be globally unique; suffix until one is free. */
async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let n = 2;

  for (;;) {
    const clash = await Product.findOne({ slug: candidate }).select("_id").lean();
    if (!clash || (excludeId && String(clash._id) === excludeId)) return candidate;
    candidate = `${base}-${n++}`;
  }
}

function embeddingText(input: ProductInput): string {
  return [
    input.name,
    input.category,
    input.fabricType,
    input.specifications?.composition,
    input.description,
    input.specifications?.weave,
    input.specifications?.finish,
    input.tags?.join(" "),
    input.colors?.map((c) => c.name).join(" "),
  ]
    .filter(Boolean)
    .join(". ");
}

/**
 * Embeds a product so it is reachable by semantic search from the moment it is
 * listed. Failure is non-fatal: an unembedded product still appears in browse
 * and keyword results, which beats refusing to save the supplier's work.
 */
async function attachEmbedding(doc: Record<string, unknown>, input: ProductInput) {
  try {
    const { vector, provider, dim } = await embed(embeddingText(input));
    doc.embedding = vector;
    doc.embeddingMeta = { provider, dim };
  } catch (err) {
    console.warn(`[supplier] embedding failed for "${input.name}": ${(err as Error).message}`);
  }
}

export async function listSupplierProducts(
  supplierId: string,
  opts: { q?: string; status?: string; page?: number; limit?: number } = {},
) {
  await connectDB();
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;

  const filter: Record<string, unknown> = { supplier: new Types.ObjectId(supplierId) };
  if (opts.status) filter.status = opts.status;
  if (opts.q) {
    const rx = new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { tags: rx }, { category: rx }];
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .select("name slug category fabricType images pricePerUnit unit stock status featured minimumOrderQuantity rating orderCount updatedAt")
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return { products, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

/**
 * A single product for the edit screen. The supplier id is part of the filter,
 * so another supplier's id matches nothing and 404s rather than leaking a row.
 */
export async function getSupplierProduct(supplierId: string, productId: string) {
  await connectDB();

  if (!Types.ObjectId.isValid(productId)) {
    throw new AppError("NOT_FOUND", "Product not found.", 404);
  }

  const product = await Product.findOne({
    _id: new Types.ObjectId(productId),
    supplier: new Types.ObjectId(supplierId),
  }).lean();

  if (!product) throw new AppError("NOT_FOUND", "Product not found.", 404);
  return product;
}

/** The full supplier profile, for the business profile screen. */
export async function getSupplierProfile(userId: string) {
  await connectDB();
  const profile = await SupplierProfile.findOne({
    user: new Types.ObjectId(userId),
  }).lean();

  if (!profile) {
    throw new AppError(
      "PROFILE_INCOMPLETE",
      "Finish setting up your business profile first.",
      409,
    );
  }
  return profile;
}

export async function createProduct(supplierId: string, input: ProductInput) {
  await connectDB();

  const doc: Record<string, unknown> = {
    ...input,
    supplier: new Types.ObjectId(supplierId),
    slug: await uniqueSlug(input.name),
    currency: "INR",
    // Stock and status must agree, whatever the form submitted.
    status: input.stock === 0 ? "out_of_stock" : input.status,
  };

  await attachEmbedding(doc, input);

  const product = await Product.create(doc);
  invalidateEmbeddingCache();
  return product.toJSON();
}

export async function updateProduct(
  supplierId: string,
  productId: string,
  input: Partial<ProductInput>,
) {
  await connectDB();

  const existing = await Product.findOne({
    _id: new Types.ObjectId(productId),
    supplier: new Types.ObjectId(supplierId),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Product not found.", 404);

  Object.assign(existing, input);

  if (input.name && input.name !== existing.name) {
    existing.slug = await uniqueSlug(input.name, productId);
  }
  if (input.stock !== undefined) {
    existing.status =
      input.stock === 0 ? "out_of_stock" : (input.status ?? existing.status ?? "active");
  }

  // Only re-embed when something the vector is built from actually changed.
  const embeddingFields = ["name", "description", "category", "fabricType", "tags", "specifications", "colors"] as const;
  if (embeddingFields.some((f) => f in input)) {
    const merged = { ...existing.toObject(), ...input } as unknown as ProductInput;
    const doc: Record<string, unknown> = {};
    await attachEmbedding(doc, merged);
    if (doc.embedding) {
      existing.set("embedding", doc.embedding);
      existing.set("embeddingMeta", doc.embeddingMeta);
    }
  }

  await existing.save();
  invalidateEmbeddingCache();
  return existing.toJSON();
}

export async function deleteProduct(supplierId: string, productId: string) {
  await connectDB();
  const res = await Product.deleteOne({
    _id: new Types.ObjectId(productId),
    supplier: new Types.ObjectId(supplierId),
  });
  if (res.deletedCount !== 1) throw new AppError("NOT_FOUND", "Product not found.", 404);

  invalidateEmbeddingCache();
  return { deleted: true };
}

/** Quick stock edit from the inventory table, without a full product update. */
export async function updateStock(supplierId: string, productId: string, stock: number) {
  await connectDB();

  const filter = {
    _id: new Types.ObjectId(productId),
    supplier: new Types.ObjectId(supplierId),
  };

  const existing = await Product.findOne(filter).select("status").lean();
  if (!existing) throw new AppError("NOT_FOUND", "Product not found.", 404);

  // Restocking must not publish a listing the supplier deliberately unlisted —
  // `draft` is a decision, `out_of_stock` is a consequence.
  const status =
    existing.status === "draft"
      ? "draft"
      : stock === 0
        ? "out_of_stock"
        : "active";

  const product = await Product.findOneAndUpdate(
    filter,
    { $set: { stock, status } },
    { returnDocument: "after" },
  ).lean();

  if (!product) throw new AppError("NOT_FOUND", "Product not found.", 404);
  return product;
}

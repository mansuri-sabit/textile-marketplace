// Mongoose 9 renamed FilterQuery to QueryFilter.
import type { QueryFilter, PipelineStage } from "mongoose";
import { Product, SupplierProfile, type ProductDoc } from "../models";
import type { ProductQuery, SortOption } from "../validators/product";

/**
 * All product read queries live here so the filter semantics exist in exactly
 * one place — the grid, the AI assistant and the facet counts must never
 * disagree about what "in stock under ₹300" means.
 */

/** Fields the browser needs for a grid card. Deliberately excludes the heavy ones. */
const CARD_FIELDS =
  "name slug category fabricType images pricePerUnit unit currency stock status featured rating ratingCount minimumOrderQuantity specifications.gsm specifications.composition supplier createdAt";

export type ProductFilter = QueryFilter<ProductDoc>;

export async function buildFilter(query: ProductQuery): Promise<ProductFilter> {
  const filter: ProductFilter = {};

  // Out-of-stock products stay visible by default so a buyer can still find a
  // fabric and see it is unavailable, rather than concluding it does not exist.
  filter.status = query.inStockOnly ? "active" : { $in: ["active", "out_of_stock"] };
  if (query.inStockOnly) filter.stock = { $gt: 0 };

  if (query.category.length) filter.category = { $in: query.category };
  if (query.fabricType.length) filter.fabricType = { $in: query.fabricType };
  if (query.unit.length) filter.unit = { $in: query.unit };
  if (query.featured) filter.featured = true;

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.pricePerUnit = {};
    if (query.minPrice !== undefined) filter.pricePerUnit.$gte = query.minPrice;
    if (query.maxPrice !== undefined) filter.pricePerUnit.$lte = query.maxPrice;
  }

  if (query.minGsm !== undefined || query.maxGsm !== undefined) {
    filter["specifications.gsm"] = {};
    if (query.minGsm !== undefined) filter["specifications.gsm"].$gte = query.minGsm;
    if (query.maxGsm !== undefined) filter["specifications.gsm"].$lte = query.maxGsm;
  }

  if (query.certification) {
    filter["specifications.certifications"] = query.certification;
  }

  if (query.supplier) {
    const supplier = await SupplierProfile.findOne({ slug: query.supplier })
      .select("_id")
      .lean();
    // An unknown supplier slug must return nothing, not silently ignore the
    // filter and return the entire catalog.
    filter.supplier = supplier?._id ?? null;
  }

  return filter;
}

export function sortSpec(sort: SortOption, hasQuery: boolean): Record<string, 1 | -1> {
  switch (sort) {
    case "price_asc":
      return { pricePerUnit: 1 };
    case "price_desc":
      return { pricePerUnit: -1 };
    case "rating":
      return { rating: -1, ratingCount: -1 };
    case "popular":
      return { orderCount: -1, viewCount: -1 };
    case "newest":
      return { createdAt: -1 };
    case "relevance":
    default:
      // With no search term "relevance" has nothing to rank by, so fall back to
      // a curated order rather than an arbitrary one.
      return hasQuery ? { createdAt: -1 } : { featured: -1, rating: -1, orderCount: -1 };
  }
}

export async function findProducts(
  filter: ProductFilter,
  opts: { sort: Record<string, 1 | -1>; skip: number; limit: number },
) {
  return Product.find(filter)
    .select(CARD_FIELDS)
    .populate("supplier", "businessName slug verified address.city rating")
    .sort(opts.sort)
    .skip(opts.skip)
    .limit(opts.limit)
    .lean();
}

export function countProducts(filter: ProductFilter) {
  return Product.countDocuments(filter);
}

export function findBySlug(slug: string) {
  return Product.findOne({ slug })
    .populate(
      "supplier",
      "businessName slug businessType description verified rating ratingCount address contactEmail contactPhone operatingHours minimumOrderQuantity yearEstablished",
    )
    .lean();
}

export function findByIds(ids: string[]) {
  return Product.find({ _id: { $in: ids } })
    .select(CARD_FIELDS)
    .populate("supplier", "businessName slug verified address.city rating")
    .lean();
}

/**
 * Facet counts for the filter sidebar, computed against the *other* active
 * filters so the numbers reflect what clicking each option would actually
 * return. `$facet` keeps this to a single round trip.
 */
export async function facetCounts(filter: ProductFilter) {
  const pipeline: PipelineStage[] = [
    { $match: filter },
    {
      $facet: {
        categories: [{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        fabricTypes: [{ $group: { _id: "$fabricType", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        units: [{ $group: { _id: "$unit", count: { $sum: 1 } } }],
        certifications: [
          { $unwind: "$specifications.certifications" },
          { $group: { _id: "$specifications.certifications", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        price: [
          {
            $group: {
              _id: null,
              min: { $min: "$pricePerUnit" },
              max: { $max: "$pricePerUnit" },
            },
          },
        ],
        gsm: [
          {
            $group: {
              _id: null,
              min: { $min: "$specifications.gsm" },
              max: { $max: "$specifications.gsm" },
            },
          },
        ],
      },
    },
  ];

  const [result] = await Product.aggregate(pipeline);

  const toList = (rows: Array<{ _id: string; count: number }> = []) =>
    rows.filter((r) => r._id).map((r) => ({ value: r._id, count: r.count }));

  return {
    categories: toList(result?.categories),
    fabricTypes: toList(result?.fabricTypes),
    units: toList(result?.units),
    certifications: toList(result?.certifications),
    price: {
      min: result?.price?.[0]?.min ?? 0,
      max: result?.price?.[0]?.max ?? 0,
    },
    gsm: {
      min: result?.gsm?.[0]?.min ?? 0,
      max: result?.gsm?.[0]?.max ?? 0,
    },
  };
}

/** Loads every embedding for in-memory similarity ranking. */
export function loadEmbeddings(filter: ProductFilter = {}) {
  return Product.find({ ...filter, embedding: { $exists: true } })
    .select("+embedding _id")
    .lean();
}

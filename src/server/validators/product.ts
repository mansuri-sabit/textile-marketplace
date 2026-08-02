import { z } from "zod";
import {
  FABRIC_TYPES,
  PRICING_UNITS,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
} from "../constants/marketplace";

/** Comma-separated query params (`?category=Cotton,Silk`) into a clean array. */
const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    )
    .pipe(z.array(z.enum(values)));

export const SORT_OPTIONS = [
  "relevance",
  "newest",
  "price_asc",
  "price_desc",
  "rating",
  "popular",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const productQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: csv(PRODUCT_CATEGORIES),
  fabricType: csv(FABRIC_TYPES),
  unit: csv(PRICING_UNITS),
  supplier: z.string().trim().max(120).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minGsm: z.coerce.number().min(0).optional(),
  maxGsm: z.coerce.number().min(0).optional(),
  inStockOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  certification: z.string().trim().max(80).optional(),
  sort: z.enum(SORT_OPTIONS).default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;

/** Parses a URLSearchParams straight into a validated query object. */
export function parseProductQuery(params: URLSearchParams): ProductQuery {
  return productQuerySchema.parse(Object.fromEntries(params.entries()));
}

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour");

/**
 * The product shape with **no defaults**.
 *
 * Defaults belong to creation only. `.partial()` does not strip them, so a
 * schema carrying `stock: 0` and `tags: []` would silently zero the stock and
 * wipe the tags of any PATCH that did not mention them — a partial update that
 * quietly destroys the fields it was not given.
 */
const productShape = z.object({
  name: z.string().trim().min(3, "Name is too short").max(180),
  description: z.string().trim().min(20, "Describe the fabric in a bit more detail").max(4000),
  category: z.enum(PRODUCT_CATEGORIES),
  fabricType: z.enum(FABRIC_TYPES),
  images: z.array(z.string().url()).min(1, "Add at least one image").max(8),
  colors: z
    .array(z.object({ name: z.string().trim().min(1), hex: hexColor, inStock: z.boolean().default(true) }))
    .max(12),
  specifications: z.object({
    gsm: z.coerce.number().min(0).optional(),
    widthInches: z.coerce.number().min(0).optional(),
    composition: z.string().trim().max(200).optional(),
    weave: z.string().trim().max(100).optional(),
    finish: z.string().trim().max(200).optional(),
    shrinkage: z.string().trim().max(100).optional(),
    careInstructions: z.string().trim().max(300).optional(),
    certifications: z.array(z.string().trim().max(80)).max(10).default([]),
  }),
  pricePerUnit: z.coerce.number().min(1, "Price is required"),
  unit: z.enum(PRICING_UNITS),
  bulkTiers: z
    .array(
      z.object({
        minQuantity: z.coerce.number().int().min(1),
        pricePerUnit: z.coerce.number().min(0),
      }),
    )
    .max(5),
  stock: z.coerce.number().int().min(0),
  minimumOrderQuantity: z.coerce.number().int().min(1),
  status: z.enum(PRODUCT_STATUSES),
  tags: z.array(z.string().trim().max(40)).max(20),
});

/** Creation: the optional half of a listing falls back to sensible defaults. */
export const productInputSchema = productShape.extend({
  colors: productShape.shape.colors.default([]),
  // The default has to satisfy the *output* type, which already required
  // certifications because of the inner .default([]).
  specifications: productShape.shape.specifications.default({ certifications: [] }),
  unit: productShape.shape.unit.default("metre"),
  bulkTiers: productShape.shape.bulkTiers.default([]),
  stock: productShape.shape.stock.default(0),
  minimumOrderQuantity: productShape.shape.minimumOrderQuantity.default(1),
  status: productShape.shape.status.default("active"),
  tags: productShape.shape.tags.default([]),
});

export type ProductInput = z.infer<typeof productInputSchema>;

/**
 * PATCH: every field optional, each still validated if present, and a field
 * left out stays exactly as it was.
 */
export const productUpdateSchema = productShape.partial();

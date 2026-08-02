import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import {
  FABRIC_TYPES,
  LOW_STOCK_THRESHOLD,
  PRICING_UNITS,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
} from "../constants/marketplace";

const colorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Hex swatch so the UI can render colours without an image per variant. */
    hex: { type: String, required: true, match: /^#[0-9a-fA-F]{6}$/ },
    inStock: { type: Boolean, default: true },
  },
  { _id: false },
);

/**
 * Textile-specific attributes. Modelled as named fields rather than a loose map
 * so they can be filtered and compared by the AI assistant.
 */
const specificationsSchema = new Schema(
  {
    gsm: { type: Number, min: 0 },
    widthInches: { type: Number, min: 0 },
    composition: { type: String, trim: true },
    weave: { type: String, trim: true },
    finish: { type: String, trim: true },
    shrinkage: { type: String, trim: true },
    careInstructions: { type: String, trim: true },
    certifications: [{ type: String, trim: true }],
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    supplier: {
      type: Schema.Types.ObjectId,
      ref: "SupplierProfile",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, required: true, maxlength: 4000 },
    category: {
      type: String,
      enum: PRODUCT_CATEGORIES,
      required: true,
      index: true,
    },
    fabricType: { type: String, enum: FABRIC_TYPES, required: true },

    images: {
      type: [{ type: String }],
      validate: {
        validator: (v: string[]) => v.length > 0 && v.length <= 8,
        message: "A product needs between 1 and 8 images",
      },
    },
    colors: { type: [colorSchema], default: [] },
    specifications: { type: specificationsSchema, default: () => ({}) },

    pricePerUnit: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: PRICING_UNITS, default: "metre" },
    currency: { type: String, default: "INR" },
    /** Optional slab pricing: cheaper per unit above a quantity threshold. */
    bulkTiers: {
      type: [
        new Schema(
          {
            minQuantity: { type: Number, required: true, min: 1 },
            pricePerUnit: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    stock: { type: Number, required: true, min: 0, default: 0 },
    minimumOrderQuantity: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: PRODUCT_STATUSES,
      default: "active",
      index: true,
    },
    featured: { type: Boolean, default: false, index: true },

    tags: [{ type: String, trim: true, lowercase: true }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },
    orderCount: { type: Number, default: 0, min: 0 },

    /**
     * Sentence-embedding of name + description + tags, used for semantic search
     * and "similar products". Excluded from every read by default — shipping a
     * 384-float array to the browser on a 24-item grid is pure waste.
     */
    embedding: { type: [Number], select: false, default: undefined },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

// Keyword search fallback for when the AI/semantic path is unavailable.
productSchema.index({ name: "text", description: "text", tags: "text" });
// Drives the default grid: active products filtered by category, newest first.
productSchema.index({ status: 1, category: 1, createdAt: -1 });
productSchema.index({ status: 1, pricePerUnit: 1 });

productSchema.virtual("isLowStock").get(function () {
  return this.stock > 0 && this.stock <= LOW_STOCK_THRESHOLD;
});

productSchema.virtual("inStock").get(function () {
  return this.status === "active" && this.stock > 0;
});

export type ProductDoc = InferSchemaType<typeof productSchema>;

export const Product: Model<ProductDoc> =
  (models.Product as Model<ProductDoc>) ??
  model<ProductDoc>("Product", productSchema);

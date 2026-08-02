import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import {
  BUSINESS_TYPES,
  FABRIC_TYPES,
  PRODUCT_CATEGORIES,
} from "../constants/marketplace";

const addressSchema = new Schema(
  {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, default: "India", trim: true },
  },
  { _id: false },
);

/** Per-day opening hours in 24h "HH:mm" form; `closed` wins over the times. */
const dayHoursSchema = new Schema(
  {
    open: { type: String, default: "09:00" },
    close: { type: String, default: "18:00" },
    closed: { type: Boolean, default: false },
  },
  { _id: false },
);

const operatingHoursSchema = new Schema(
  {
    monday: { type: dayHoursSchema, default: () => ({}) },
    tuesday: { type: dayHoursSchema, default: () => ({}) },
    wednesday: { type: dayHoursSchema, default: () => ({}) },
    thursday: { type: dayHoursSchema, default: () => ({}) },
    friday: { type: dayHoursSchema, default: () => ({}) },
    saturday: { type: dayHoursSchema, default: () => ({}) },
    sunday: { type: dayHoursSchema, default: () => ({ closed: true }) },
  },
  { _id: false },
);

/**
 * Business identity for a supplier account. Kept out of `User` because it is
 * public-facing (rendered on product pages) while `User` holds credentials.
 */
const supplierProfileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    businessName: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, index: true },
    businessType: { type: String, enum: BUSINESS_TYPES, required: true },
    description: { type: String, maxlength: 2000 },
    logoUrl: { type: String },

    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    contactPhone: { type: String, required: true, trim: true },
    website: { type: String, trim: true },

    address: { type: addressSchema, required: true },
    operatingHours: { type: operatingHoursSchema, default: () => ({}) },

    categories: [{ type: String, enum: PRODUCT_CATEGORIES }],
    fabricTypes: [{ type: String, enum: FABRIC_TYPES }],
    /** Business-wide minimum order quantity; a product may override it. */
    minimumOrderQuantity: { type: Number, default: 1, min: 1 },

    gstNumber: { type: String, trim: true },
    yearEstablished: { type: Number, min: 1800 },
    verified: { type: Boolean, default: false },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

supplierProfileSchema.index({ businessName: "text", description: "text" });

export type SupplierProfileDoc = InferSchemaType<typeof supplierProfileSchema>;

export const SupplierProfile: Model<SupplierProfileDoc> =
  (models.SupplierProfile as Model<SupplierProfileDoc>) ??
  model<SupplierProfileDoc>("SupplierProfile", supplierProfileSchema);

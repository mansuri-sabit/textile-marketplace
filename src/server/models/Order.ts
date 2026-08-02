import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { ORDER_STATUSES } from "../constants/marketplace";

/**
 * Line items denormalise product name/image/price on purpose. An order is a
 * historical record: if the supplier later renames the product or drops it,
 * the buyer's past order must still render exactly as it was placed.
 */
const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    image: { type: String },
    color: { type: String },
    unit: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    pricePerUnit: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const shippingAddressSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, default: "India" },
  },
  { _id: false },
);

const statusEventSchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, maxlength: 500 },
  },
  { _id: false },
);

/**
 * One order per supplier. A multi-supplier cart splits into several orders at
 * checkout so each supplier only ever sees and fulfils their own line items —
 * the same way real B2B marketplaces work.
 */
const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: "SupplierProfile",
      required: true,
      index: true,
    },
    /** Groups the sibling orders created by a single checkout. */
    checkoutGroupId: { type: String, required: true, index: true },

    items: { type: [orderItemSchema], required: true },
    shippingAddress: { type: shippingAddressSchema, required: true },
    buyerNote: { type: String, maxlength: 1000 },

    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },

    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "pending",
      index: true,
    },
    statusHistory: {
      type: [statusEventSchema],
      default: () => [{ status: "pending" }],
    },
    expectedDispatchDate: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

// Supplier dashboard: "my orders, newest first", optionally filtered by status.
orderSchema.index({ supplier: 1, status: 1, createdAt: -1 });
// Buyer dashboard: "my orders, newest first".
orderSchema.index({ buyer: 1, createdAt: -1 });

export type OrderDoc = InferSchemaType<typeof orderSchema>;

export const Order: Model<OrderDoc> =
  (models.Order as Model<OrderDoc>) ?? model<OrderDoc>("Order", orderSchema);

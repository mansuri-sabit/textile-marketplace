import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const cartItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    /** Selected colour name; must match one of the product's colour options. */
    color: { type: String, trim: true },
    /**
     * Price at the moment of adding. Kept so the cart can warn the buyer that a
     * supplier changed the price, instead of silently charging the new one.
     */
    priceSnapshot: { type: Number, required: true, min: 0 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** One open cart per buyer. Checkout clears it rather than deleting the doc. */
const cartSchema = new Schema(
  {
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

cartSchema.virtual("itemCount").get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

export type CartDoc = InferSchemaType<typeof cartSchema>;

export const Cart: Model<CartDoc> =
  (models.Cart as Model<CartDoc>) ?? model<CartDoc>("Cart", cartSchema);

import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import {
  BUDGET_RANGES,
  BUSINESS_TYPES,
  FABRIC_TYPES,
  INDUSTRIES,
  ORDER_QUANTITY_BANDS,
  PRODUCT_CATEGORIES,
  USER_ROLES,
} from "../constants/marketplace";

/**
 * Buyer preferences captured during onboarding. Embedded rather than a separate
 * collection because it is always read with the user and never queried alone.
 * These fields are what the AI assistant uses to personalise recommendations.
 */
const buyerPreferencesSchema = new Schema(
  {
    businessType: { type: String, enum: BUSINESS_TYPES },
    industry: { type: String, enum: INDUSTRIES },
    interestedCategories: [{ type: String, enum: PRODUCT_CATEGORIES }],
    preferredFabricTypes: [{ type: String, enum: FABRIC_TYPES }],
    typicalOrderQuantity: { type: String, enum: ORDER_QUANTITY_BANDS },
    budgetRange: { type: String, enum: BUDGET_RANGES },
    /** Free-text captured by the conversational onboarding flow. */
    notes: { type: String, maxlength: 1000 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Never selected by default — a stray `User.find()` must not leak hashes.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true, index: true },
    phone: { type: String, trim: true },
    avatarUrl: { type: String },

    onboardingCompleted: { type: Boolean, default: false },
    buyerPreferences: { type: buyerPreferencesSchema, default: undefined },

    /** Bumped on logout-all / password change to invalidate live refresh tokens. */
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.tokenVersion;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>("User", userSchema);

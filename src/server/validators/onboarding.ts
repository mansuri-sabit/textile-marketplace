import { z } from "zod";
import {
  BUDGET_RANGES,
  BUSINESS_TYPES,
  FABRIC_TYPES,
  INDUSTRIES,
  OPERATING_HOURS_PRESET_KEYS,
  ORDER_QUANTITY_BANDS,
  PRODUCT_CATEGORIES,
} from "../constants/marketplace";

/**
 * Onboarding is collected conversationally, one answer at a time, so every
 * field is validated in isolation on the client too. These schemas are the
 * server's copy of the same rules — the chat can be skipped with a direct POST.
 */

export const buyerOnboardingSchema = z.object({
  businessType: z.enum(BUSINESS_TYPES),
  industry: z.enum(INDUSTRIES),
  interestedCategories: z
    .array(z.enum(PRODUCT_CATEGORIES))
    .min(1, "Pick at least one category")
    .max(PRODUCT_CATEGORIES.length),
  preferredFabricTypes: z.array(z.enum(FABRIC_TYPES)).max(FABRIC_TYPES.length),
  typicalOrderQuantity: z.enum(ORDER_QUANTITY_BANDS),
  budgetRange: z.enum(BUDGET_RANGES),
  notes: z.string().trim().max(1000).optional(),
});

export const supplierOnboardingSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required").max(160),
  businessType: z.enum(BUSINESS_TYPES),
  description: z.string().trim().max(2000).optional(),

  contactEmail: z.string().trim().toLowerCase().email("Enter a valid email address"),
  contactPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number"),
  website: z.string().trim().max(200).optional(),

  address: z.object({
    line1: z.string().trim().min(3, "Address is required").max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(2, "City is required").max(80),
    state: z.string().trim().min(2, "State is required").max(80),
    postalCode: z
      .string()
      .trim()
      .regex(/^[0-9]{6}$/, "Enter a 6-digit PIN code"),
    country: z.string().trim().max(80).default("India"),
  }),

  operatingHours: z.enum(OPERATING_HOURS_PRESET_KEYS),

  categories: z
    .array(z.enum(PRODUCT_CATEGORIES))
    .min(1, "Pick at least one category")
    .max(PRODUCT_CATEGORIES.length),
  fabricTypes: z.array(z.enum(FABRIC_TYPES)).max(FABRIC_TYPES.length),
  minimumOrderQuantity: z.coerce.number().int().min(1).max(100000),

  gstNumber: z.string().trim().max(20).optional(),
  yearEstablished: z.coerce.number().int().min(1800).max(2100).optional(),
});

export type BuyerOnboardingInput = z.infer<typeof buyerOnboardingSchema>;
export type SupplierOnboardingInput = z.infer<typeof supplierOnboardingSchema>;

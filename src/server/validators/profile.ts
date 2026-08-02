import { z } from "zod";
import {
  BUSINESS_TYPES,
  FABRIC_TYPES,
  PRODUCT_CATEGORIES,
} from "../constants/marketplace";

/**
 * Profile editing, as distinct from onboarding.
 *
 * Onboarding is a one-pass conversation that writes the whole record; this is
 * the field-by-field editor a business actually uses afterwards. Both write the
 * same documents, so the rules here mirror `validators/onboarding.ts` — and
 * like every update schema in this codebase, these carry **no defaults**, so a
 * PATCH cannot wipe a field it did not mention.
 */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const dayHoursSchema = z.object({
  open: z.string().regex(HHMM, "Use 24-hour HH:MM"),
  close: z.string().regex(HHMM, "Use 24-hour HH:MM"),
  closed: z.boolean(),
});

export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const operatingHoursSchema = z.object({
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
  sunday: dayHoursSchema,
});

/** The buyer's own account. Email is deliberately not editable — it is the
 *  login identity and changing it needs a verification flow this prototype
 *  does not have. */
export const buyerAccountSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(120),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number")
      .or(z.literal("")),
  })
  .partial();

export const supplierProfileSchema = z
  .object({
    businessName: z.string().trim().min(2, "Business name is required").max(160),
    businessType: z.enum(BUSINESS_TYPES),
    description: z.string().trim().max(2000).or(z.literal("")),

    contactEmail: z.string().trim().toLowerCase().email("Enter a valid email address"),
    contactPhone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number"),
    website: z.string().trim().max(200).or(z.literal("")),

    address: z.object({
      line1: z.string().trim().min(3, "Address is required").max(200),
      line2: z.string().trim().max(200).or(z.literal("")),
      city: z.string().trim().min(2, "City is required").max(80),
      state: z.string().trim().min(2, "State is required").max(80),
      postalCode: z
        .string()
        .trim()
        .regex(/^[0-9]{6}$/, "Enter a 6-digit PIN code"),
      country: z.string().trim().max(80),
    }),

    operatingHours: operatingHoursSchema,

    categories: z
      .array(z.enum(PRODUCT_CATEGORIES))
      .min(1, "Pick at least one category")
      .max(PRODUCT_CATEGORIES.length),
    fabricTypes: z.array(z.enum(FABRIC_TYPES)).max(FABRIC_TYPES.length),
    minimumOrderQuantity: z.coerce.number().int().min(1).max(100000),

    gstNumber: z.string().trim().max(20).or(z.literal("")),
    yearEstablished: z.coerce.number().int().min(1800).max(2100),
  })
  .partial();

export type BuyerAccountInput = z.infer<typeof buyerAccountSchema>;
export type SupplierProfileInput = z.infer<typeof supplierProfileSchema>;

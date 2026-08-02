import { z } from "zod";

export const addToCartSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid product"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(100000),
  color: z.string().trim().max(80).optional(),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(100000),
  color: z.string().trim().max(80).optional(),
});

export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number"),
  line1: z.string().trim().min(3, "Address is required").max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, "City is required").max(80),
  state: z.string().trim().min(2, "State is required").max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "Enter a 6-digit PIN code"),
  country: z.string().trim().max(80).default("India"),
});

export const checkoutSchema = z.object({
  shippingAddress: shippingAddressSchema,
  buyerNote: z.string().trim().max(1000).optional(),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/**
 * Single source of truth for the marketplace vocabulary.
 * Schemas, validators, and UI filters all derive from these lists so a new
 * category or status only ever has to be added in one place.
 */

export const USER_ROLES = ["buyer", "supplier"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PRODUCT_CATEGORIES = [
  "Cotton",
  "Silk",
  "Linen",
  "Wool",
  "Denim",
  "Rayon & Viscose",
  "Polyester & Blends",
  "Velvet",
  "Chiffon & Georgette",
  "Knits & Jersey",
  "Embroidered & Ethnic",
  "Technical & Performance",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const FABRIC_TYPES = [
  "Woven",
  "Knitted",
  "Non-woven",
  "Blended",
  "Handloom",
  "Printed",
  "Dyed",
  "Embroidered",
] as const;
export type FabricType = (typeof FABRIC_TYPES)[number];

export const PRODUCT_STATUSES = ["draft", "active", "out_of_stock"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** Sold-by unit. B2B textile is priced per metre/yard/kg, not per piece. */
export const PRICING_UNITS = ["metre", "yard", "kg", "piece", "roll"] as const;
export type PricingUnit = (typeof PRICING_UNITS)[number];

export const BUSINESS_TYPES = [
  "Manufacturer",
  "Wholesaler",
  "Retailer",
  "Boutique / Designer",
  "Exporter",
  "Garment Factory",
  "Sourcing Agent",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const INDUSTRIES = [
  "Apparel & Fashion",
  "Home Furnishing",
  "Automotive Textiles",
  "Medical Textiles",
  "Sportswear",
  "Uniforms & Workwear",
  "Bridal & Occasion Wear",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

/**
 * Supplier-facing order lifecycle. Order is meaningful: a status may only move
 * forward, and `cancelled` is reachable from any non-terminal state.
 */
export const ORDER_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready_for_dispatch",
  "completed",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  ready_for_dispatch: "Ready for Dispatch",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Allowed forward transitions. Empty array = terminal state. */
export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready_for_dispatch", "cancelled"],
  ready_for_dispatch: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_FLOW[from]?.includes(to) ?? false;
}

export const ORDER_QUANTITY_BANDS = [
  "Under 100",
  "100 - 500",
  "500 - 2,000",
  "2,000 - 10,000",
  "10,000+",
] as const;

export const BUDGET_RANGES = [
  "Under ₹50,000",
  "₹50,000 - ₹2,00,000",
  "₹2,00,000 - ₹10,00,000",
  "₹10,00,000+",
] as const;

/** Stock at or below this many units triggers a supplier inventory alert. */
export const LOW_STOCK_THRESHOLD = 50;

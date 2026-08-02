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

/**
 * Opening hours offered as three presets during onboarding rather than fourteen
 * time inputs. A supplier setting up their account cares about being findable,
 * not about encoding Tuesday to the minute — the full per-day grid belongs in
 * the profile editor, and the schema stores that shape either way.
 */
function week(open: string, close: string, sundayClosed: boolean) {
  const day = { open, close, closed: false };
  return {
    monday: day,
    tuesday: day,
    wednesday: day,
    thursday: day,
    friday: day,
    saturday: day,
    sunday: { open, close, closed: sundayClosed },
  };
}

export const OPERATING_HOURS_PRESETS = {
  standard: {
    label: "Mon–Sat, 9:00–18:00 · Sunday closed",
    hours: week("09:00", "18:00", true),
  },
  extended: {
    label: "Mon–Sat, 8:00–20:00 · Sunday closed",
    hours: week("08:00", "20:00", true),
  },
  allweek: {
    label: "Every day, 9:00–18:00",
    hours: week("09:00", "18:00", false),
  },
} as const;

export type OperatingHoursPreset = keyof typeof OPERATING_HOURS_PRESETS;

export const OPERATING_HOURS_PRESET_KEYS = Object.keys(
  OPERATING_HOURS_PRESETS,
) as [OperatingHoursPreset, ...OperatingHoursPreset[]];

export type BulkTier = { minQuantity: number; pricePerUnit: number };

/**
 * B2B pricing is quantity-dependent. The unit price a buyer actually pays is
 * the best tier their quantity qualifies for, so this must be applied
 * everywhere a total is shown — cart, checkout and the order record — or the
 * numbers will disagree with each other.
 */
export function effectiveUnitPrice(
  basePrice: number,
  tiers: BulkTier[] | undefined,
  quantity: number,
): number {
  if (!tiers?.length) return basePrice;

  const qualifying = tiers
    .filter((t) => quantity >= t.minQuantity)
    .sort((a, b) => a.pricePerUnit - b.pricePerUnit);

  return qualifying.length ? Math.min(basePrice, qualifying[0].pricePerUnit) : basePrice;
}

/** GST on textiles sits at 5% for most fabric HSN codes. */
export const TAX_RATE = 0.05;

export function orderTotals(subtotal: number, shippingFee = 0) {
  const taxAmount = Math.round(subtotal * TAX_RATE);
  return { subtotal, shippingFee, taxAmount, total: subtotal + shippingFee + taxAmount };
}

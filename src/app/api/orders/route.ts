import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { requireBuyer } from "@/server/middleware/session";
import { listBuyerOrders, placeOrder } from "@/server/services/order.service";
import { checkoutSchema } from "@/server/validators/cart";
import { ORDER_STATUSES, type OrderStatus } from "@/server/constants/marketplace";

export const runtime = "nodejs";

/** GET /api/orders — the buyer's own orders. */
export const GET = route(async (req: NextRequest) => {
  const session = await requireBuyer();
  const params = req.nextUrl.searchParams;
  const raw = params.get("status");
  const status = ORDER_STATUSES.includes(raw as OrderStatus)
    ? (raw as OrderStatus)
    : undefined;

  return ok(
    await listBuyerOrders(session.sub, {
      status,
      page: Number(params.get("page")) || 1,
      limit: Math.min(Number(params.get("limit")) || 20, 50),
    }),
  );
});

/**
 * POST /api/orders — checkout.
 * A multi-supplier cart becomes one order per supplier, grouped by a shared
 * checkoutGroupId so the confirmation screen can present them as one purchase.
 */
export const POST = route(async (req: NextRequest) => {
  const session = await requireBuyer();
  const input = checkoutSchema.parse(await req.json());
  return ok(await placeOrder(session.sub, input), 201);
});

import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { requireBuyer } from "@/server/middleware/session";
import { addItem, clearCart, getCart } from "@/server/services/cart.service";
import { addToCartSchema } from "@/server/validators/cart";

export const runtime = "nodejs";

/** GET /api/cart — the buyer's cart, resolved against live products. */
export const GET = route(async () => {
  const session = await requireBuyer();
  return ok(await getCart(session.sub));
});

/** POST /api/cart — add an item (tops up an existing line for the same colour). */
export const POST = route(async (req: NextRequest) => {
  const session = await requireBuyer();
  const input = addToCartSchema.parse(await req.json());
  return ok(await addItem(session.sub, input));
});

/** DELETE /api/cart — empty the cart. */
export const DELETE = route(async () => {
  const session = await requireBuyer();
  return ok(await clearCart(session.sub));
});

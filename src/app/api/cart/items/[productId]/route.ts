import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { requireBuyer } from "@/server/middleware/session";
import { removeItem, updateItem } from "@/server/services/cart.service";
import { updateCartItemSchema } from "@/server/validators/cart";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ productId: string }> };

/** PATCH /api/cart/items/:productId — change quantity; 0 removes the line. */
export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireBuyer();
  const { productId } = await ctx.params;
  const { quantity, color } = updateCartItemSchema.parse(await req.json());
  return ok(await updateItem(session.sub, productId, quantity, color));
});

/** DELETE /api/cart/items/:productId — remove one line (colour-specific). */
export const DELETE = route(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireBuyer();
  const { productId } = await ctx.params;
  const color = req.nextUrl.searchParams.get("color") ?? undefined;
  return ok(await removeItem(session.sub, productId, color));
});

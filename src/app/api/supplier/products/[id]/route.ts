import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { requireSupplier } from "@/server/middleware/session";
import {
  deleteProduct,
  requireSupplierProfile,
  updateProduct,
} from "@/server/services/supplier.service";
import { productUpdateSchema } from "@/server/validators/product";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/supplier/products/:id
 * Ownership is enforced in the query itself — another supplier's id simply
 * matches nothing and returns 404, never a partial write.
 */
export const PATCH = route(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireSupplier();
  const profile = await requireSupplierProfile(session.sub);
  const { id } = await ctx.params;
  const input = productUpdateSchema.parse(await req.json());
  return ok({ product: await updateProduct(String(profile._id), id, input) });
});

/** DELETE /api/supplier/products/:id */
export const DELETE = route(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireSupplier();
  const profile = await requireSupplierProfile(session.sub);
  const { id } = await ctx.params;
  return ok(await deleteProduct(String(profile._id), id));
});

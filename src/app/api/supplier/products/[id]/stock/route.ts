import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, route } from "@/server/lib/api";
import { requireSupplier } from "@/server/middleware/session";
import { requireSupplierProfile, updateStock } from "@/server/services/supplier.service";

export const runtime = "nodejs";

const schema = z.object({ stock: z.coerce.number().int().min(0).max(1_000_000) });

/**
 * PATCH /api/supplier/products/:id/stock
 * Separate from the full update so the inventory table can save a single
 * number without round-tripping the entire product.
 */
export const PATCH = route(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireSupplier();
    const profile = await requireSupplierProfile(session.sub);
    const { id } = await ctx.params;
    const { stock } = schema.parse(await req.json());
    return ok({ product: await updateStock(String(profile._id), id, stock) });
  },
);

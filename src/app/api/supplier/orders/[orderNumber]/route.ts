import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, route } from "@/server/lib/api";
import { ORDER_STATUSES } from "@/server/constants/marketplace";
import { requireSupplier } from "@/server/middleware/session";
import { updateOrderStatus } from "@/server/services/order.service";
import { requireSupplierProfile } from "@/server/services/supplier.service";

export const runtime = "nodejs";

const schema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
});

/**
 * PATCH /api/supplier/orders/:orderNumber
 *
 * Advances the order. Only the transitions defined by ORDER_STATUS_FLOW are
 * accepted, so an order cannot skip stages or move backwards, and cancelling
 * returns the reserved stock to the catalog.
 */
export const PATCH = route(
  async (req: NextRequest, ctx: { params: Promise<{ orderNumber: string }> }) => {
    const session = await requireSupplier();
    const profile = await requireSupplierProfile(session.sub);
    const { orderNumber } = await ctx.params;
    const { status, note } = schema.parse(await req.json());

    return ok({
      order: await updateOrderStatus(String(profile._id), orderNumber, status, note),
    });
  },
);

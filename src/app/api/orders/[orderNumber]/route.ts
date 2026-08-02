import { ok, route } from "@/server/lib/api";
import { requireBuyer } from "@/server/middleware/session";
import { getBuyerOrder } from "@/server/services/order.service";

export const runtime = "nodejs";

/** GET /api/orders/:orderNumber — buyer's own order, with tracking history. */
export const GET = route(
  async (_req: Request, ctx: { params: Promise<{ orderNumber: string }> }) => {
    const session = await requireBuyer();
    const { orderNumber } = await ctx.params;
    return ok({ order: await getBuyerOrder(session.sub, orderNumber) });
  },
);

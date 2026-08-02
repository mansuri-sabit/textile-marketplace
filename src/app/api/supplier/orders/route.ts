import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { ORDER_STATUSES, type OrderStatus } from "@/server/constants/marketplace";
import { requireSupplier } from "@/server/middleware/session";
import { listSupplierOrders } from "@/server/services/order.service";
import { requireSupplierProfile } from "@/server/services/supplier.service";

export const runtime = "nodejs";

/** GET /api/supplier/orders — incoming orders, with per-status counts for tabs. */
export const GET = route(async (req: NextRequest) => {
  const session = await requireSupplier();
  const profile = await requireSupplierProfile(session.sub);
  const params = req.nextUrl.searchParams;

  const raw = params.get("status");
  const status = ORDER_STATUSES.includes(raw as OrderStatus)
    ? (raw as OrderStatus)
    : undefined;

  return ok(
    await listSupplierOrders(String(profile._id), {
      status,
      page: Number(params.get("page")) || 1,
      limit: Math.min(Number(params.get("limit")) || 20, 50),
    }),
  );
});

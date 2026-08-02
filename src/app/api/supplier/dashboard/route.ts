import { ok, route } from "@/server/lib/api";
import { requireSupplier } from "@/server/middleware/session";
import { supplierDashboard } from "@/server/services/order.service";
import { requireSupplierProfile } from "@/server/services/supplier.service";

export const runtime = "nodejs";

/** GET /api/supplier/dashboard — product, order and inventory-alert widgets. */
export const GET = route(async () => {
  const session = await requireSupplier();
  const profile = await requireSupplierProfile(session.sub);
  return ok(await supplierDashboard(String(profile._id)));
});

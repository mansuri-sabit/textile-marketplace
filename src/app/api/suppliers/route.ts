import { ok, route } from "@/server/lib/api";
import { listSupplierDirectory } from "@/server/services/supplier.service";

export const runtime = "nodejs";

/** GET /api/suppliers — directory listing with live product counts. */
export const GET = route(async () => {
  return ok({ suppliers: await listSupplierDirectory() });
});

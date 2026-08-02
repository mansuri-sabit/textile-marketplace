import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { requireSupplier } from "@/server/middleware/session";
import {
  createProduct,
  listSupplierProducts,
  requireSupplierProfile,
} from "@/server/services/supplier.service";
import { productInputSchema } from "@/server/validators/product";

export const runtime = "nodejs";

/** GET /api/supplier/products — the signed-in supplier's own catalog. */
export const GET = route(async (req: NextRequest) => {
  const session = await requireSupplier();
  const profile = await requireSupplierProfile(session.sub);
  const params = req.nextUrl.searchParams;

  return ok(
    await listSupplierProducts(String(profile._id), {
      q: params.get("q") ?? undefined,
      status: params.get("status") ?? undefined,
      page: Number(params.get("page")) || 1,
      limit: Math.min(Number(params.get("limit")) || 20, 50),
    }),
  );
});

/** POST /api/supplier/products — list a new product. */
export const POST = route(async (req: NextRequest) => {
  const session = await requireSupplier();
  const profile = await requireSupplierProfile(session.sub);
  const input = productInputSchema.parse(await req.json());
  return ok({ product: await createProduct(String(profile._id), input) }, 201);
});

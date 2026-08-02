import { ok, route } from "@/server/lib/api";
import { getSupplierStorefront } from "@/server/services/supplier.service";

export const runtime = "nodejs";

/** GET /api/suppliers/:slug — public storefront: profile plus active catalog. */
export const GET = route(
  async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    return ok(await getSupplierStorefront(slug));
  },
);

import { ok, route } from "@/server/lib/api";
import { getProductBySlug } from "@/server/services/product.service";

export const runtime = "nodejs";

/** GET /api/products/:slug — full detail including the supplier's public profile. */
export const GET = route(
  async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    return ok({ product: await getProductBySlug(slug) });
  },
);

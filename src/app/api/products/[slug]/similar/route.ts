import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { getSimilarProducts } from "@/server/services/product.service";

export const runtime = "nodejs";

/**
 * GET /api/products/:slug/similar
 *
 * Ranked by embedding proximity, so "similar" means similar in construction
 * and use rather than merely sharing a category label.
 */
export const GET = route(
  async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 8, 24);
    return ok({ products: await getSimilarProducts(slug, limit) });
  },
);

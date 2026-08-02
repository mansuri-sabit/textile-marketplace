import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { getFacets } from "@/server/services/product.service";
import { parseProductQuery } from "@/server/validators/product";

export const runtime = "nodejs";

/**
 * GET /api/products/facets
 *
 * Counts for the filter sidebar, computed against the currently active filters
 * so each option shows how many results selecting it would actually yield.
 */
export const GET = route(async (req: NextRequest) => {
  const query = parseProductQuery(req.nextUrl.searchParams);
  return ok(await getFacets(query));
});

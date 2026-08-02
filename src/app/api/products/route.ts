import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { listProducts } from "@/server/services/product.service";
import { parseProductQuery } from "@/server/validators/product";

export const runtime = "nodejs";

/**
 * GET /api/products
 *
 * Public catalog listing. Supports filtering, sorting, pagination and natural
 * language search — the response reports which `mode` answered the query so
 * the UI can say "semantic results" rather than pretending they are identical.
 */
export const GET = route(async (req: NextRequest) => {
  const query = parseProductQuery(req.nextUrl.searchParams);
  const result = await listProducts(query);
  return ok(result);
});

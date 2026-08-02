import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { requireSupplier } from "@/server/middleware/session";
import { updateSupplierProfile } from "@/server/services/profile.service";
import { getSupplierProfile } from "@/server/services/supplier.service";
import { supplierProfileSchema } from "@/server/validators/profile";

export const runtime = "nodejs";

/** GET /api/supplier/profile — the signed-in supplier's business profile. */
export const GET = route(async () => {
  const session = await requireSupplier();
  return ok({ profile: await getSupplierProfile(session.sub) });
});

/**
 * PATCH /api/supplier/profile — edit the business profile field by field.
 *
 * Distinct from `/api/supplier/onboarding`, which writes the whole record in
 * one pass. The slug is never re-derived from a renamed business: it is the
 * public storefront URL that every product page already links to.
 */
export const PATCH = route(async (req: NextRequest) => {
  const session = await requireSupplier();
  const input = supplierProfileSchema.parse(await req.json());
  return ok({ profile: await updateSupplierProfile(session.sub, input) });
});

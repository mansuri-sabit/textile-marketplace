import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { setAuthCookies } from "@/server/lib/cookies";
import { requireSupplier } from "@/server/middleware/session";
import { reissueSession } from "@/server/services/auth.service";
import {
  completeSupplierOnboarding,
  getOnboardingState,
} from "@/server/services/onboarding.service";
import { supplierOnboardingSchema } from "@/server/validators/onboarding";

export const runtime = "nodejs";

/** GET /api/supplier/onboarding — the existing business profile, if any. */
export const GET = route(async () => {
  const session = await requireSupplier();
  return ok(await getOnboardingState(session.sub));
});

/**
 * POST /api/supplier/onboarding — create or update the business profile and
 * mark onboarding complete. Cookies are re-set for the same reason as the
 * buyer route: `onboardingCompleted` is a token claim.
 */
export const POST = route(async (req: NextRequest) => {
  const session = await requireSupplier();
  const input = supplierOnboardingSchema.parse(await req.json());

  const user = await completeSupplierOnboarding(session.sub, input);
  const { tokens } = await reissueSession(session.sub);

  return setAuthCookies(ok({ user }), tokens);
});

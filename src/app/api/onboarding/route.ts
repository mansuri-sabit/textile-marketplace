import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { setAuthCookies } from "@/server/lib/cookies";
import { requireBuyer } from "@/server/middleware/session";
import { reissueSession } from "@/server/services/auth.service";
import {
  completeBuyerOnboarding,
  getOnboardingState,
} from "@/server/services/onboarding.service";
import { buyerOnboardingSchema } from "@/server/validators/onboarding";

export const runtime = "nodejs";

/** GET /api/onboarding — previous answers, so editing starts where it left off. */
export const GET = route(async () => {
  const session = await requireBuyer();
  return ok(await getOnboardingState(session.sub));
});

/**
 * POST /api/onboarding — save buyer preferences and mark onboarding complete.
 *
 * The cookies are re-set because `onboardingCompleted` is a token claim the
 * edge proxy reads; without this the buyer would be redirected straight back
 * into onboarding on their next navigation.
 */
export const POST = route(async (req: NextRequest) => {
  const session = await requireBuyer();
  const input = buyerOnboardingSchema.parse(await req.json());

  const user = await completeBuyerOnboarding(session.sub, input);
  const { tokens } = await reissueSession(session.sub);

  return setAuthCookies(ok({ user }), tokens);
});

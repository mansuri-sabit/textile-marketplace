import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/middleware/session";
import { getOnboardingState } from "@/server/services/onboarding.service";
import { serialize } from "@/lib/serialize";
import type { BuyerPreferences } from "@/types";
import { BuyerOnboarding } from "./BuyerOnboarding";

export const metadata: Metadata = {
  title: "Set up your account",
  description: "Tell us what you source and we'll tune the catalog to match.",
};

// Reads the signed-in user's saved answers, so this can never be cached.
export const dynamic = "force-dynamic";

/**
 * `proxy.ts` sends every account with `onboardingCompleted: false` here, so
 * this route existing is what stops a fresh registration from dead-ending in a
 * 404. It stays reachable after completion too — it doubles as the preferences
 * editor linked from the buyer profile.
 */
export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fonboarding");
  if (session.role === "supplier") redirect("/supplier/onboarding");

  const state = await getOnboardingState(session.sub);
  const preferences =
    state.role === "buyer"
      ? serialize<BuyerPreferences | null>(state.buyerPreferences)
      : null;

  return (
    <BuyerOnboarding
      firstName={session.name.split(" ")[0] || "there"}
      preferences={preferences}
    />
  );
}

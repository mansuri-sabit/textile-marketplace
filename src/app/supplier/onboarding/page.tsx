import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/server/middleware/session";
import { getOnboardingState } from "@/server/services/onboarding.service";
import { serialize } from "@/lib/serialize";
import {
  SupplierOnboarding,
  type SupplierProfilePrefill,
} from "./SupplierOnboarding";

export const metadata: Metadata = {
  title: "Set up your business",
  description: "Create your supplier profile and start listing fabric.",
};

export const dynamic = "force-dynamic";

/**
 * The supplier half of the onboarding redirect in `proxy.ts`. Also reachable
 * after completion, where it edits the existing profile in place.
 */
export default async function SupplierOnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fsupplier%2Fonboarding");
  if (session.role === "buyer") redirect("/onboarding");

  const state = await getOnboardingState(session.sub);
  const profile =
    state.role === "supplier"
      ? serialize<SupplierProfilePrefill>(state.profile)
      : null;

  return (
    <SupplierOnboarding
      firstName={session.name.split(" ")[0] || "there"}
      accountEmail={state.email}
      accountPhone={state.phone ?? ""}
      profile={profile}
    />
  );
}

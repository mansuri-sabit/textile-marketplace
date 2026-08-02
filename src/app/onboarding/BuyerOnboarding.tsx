"use client";

import { useRouter } from "next/navigation";
import {
  ConversationalOnboarding,
  type OnboardingAnswers,
  type OnboardingStep,
} from "@/components/onboarding/ConversationalOnboarding";
import { api } from "@/lib/api-client";
import {
  BUDGET_RANGES,
  BUSINESS_TYPES,
  FABRIC_TYPES,
  INDUSTRIES,
  ORDER_QUANTITY_BANDS,
  PRODUCT_CATEGORIES,
} from "@/server/constants/marketplace";
import { useSession } from "@/store/session";
import type { BuyerPreferences, SessionUser } from "@/types";

/**
 * Buyer onboarding, asked one question at a time.
 *
 * The answers are what the marketplace personalises on — recommendations, the
 * default browse view and, later, the AI assistant's sense of what this buyer
 * actually sources. Everything here maps 1:1 onto `buyerPreferences`, so the
 * chat and the API cannot drift apart.
 */

const STEPS: OnboardingStep[] = [
  {
    id: "businessType",
    kind: "single",
    label: "Business",
    prompt: "First — what kind of business are you sourcing for?",
    options: BUSINESS_TYPES,
  },
  {
    id: "industry",
    kind: "single",
    label: "Industry",
    prompt: "And which industry do you mainly sell into?",
    options: INDUSTRIES,
  },
  {
    id: "interestedCategories",
    kind: "multi",
    label: "Categories",
    prompt: "Which fabric categories should I put in front of you?",
    help: "Pick as many as you like — this shapes your homepage and recommendations.",
    options: PRODUCT_CATEGORIES,
    min: 1,
  },
  {
    id: "preferredFabricTypes",
    kind: "multi",
    label: "Construction",
    prompt: "Any construction you prefer to work with?",
    help: "Woven, knitted, handloom and so on. Skip if it varies by order.",
    options: FABRIC_TYPES,
  },
  {
    id: "typicalOrderQuantity",
    kind: "single",
    label: "Order size",
    prompt: "Roughly how much do you order at a time?",
    help: "In metres or kilograms, whichever your orders are usually priced in.",
    options: ORDER_QUANTITY_BANDS,
  },
  {
    id: "budgetRange",
    kind: "single",
    label: "Budget",
    prompt: "What does a typical order budget look like?",
    options: BUDGET_RANGES,
  },
  {
    id: "notes",
    kind: "text",
    label: "Notes",
    prompt: "Anything else I should know when suggesting fabrics?",
    help: "Certifications you need, deadlines you work to, mills you already buy from — all useful.",
    placeholder: "We need GOTS-certified cotton and ship to the EU…",
    optional: true,
    multiline: true,
  },
];

/** Prefills the chat from saved preferences when someone comes back to edit. */
function toAnswers(prefs: BuyerPreferences | null): OnboardingAnswers | undefined {
  if (!prefs) return undefined;
  return {
    businessType: prefs.businessType ?? "",
    industry: prefs.industry ?? "",
    interestedCategories: prefs.interestedCategories ?? [],
    preferredFabricTypes: prefs.preferredFabricTypes ?? [],
    typicalOrderQuantity: prefs.typicalOrderQuantity ?? "",
    budgetRange: prefs.budgetRange ?? "",
    notes: prefs.notes ?? "",
  };
}

export function BuyerOnboarding({
  firstName,
  preferences,
}: {
  firstName: string;
  preferences: BuyerPreferences | null;
}) {
  const router = useRouter();
  const setUser = useSession((s) => s.setUser);

  async function submit(answers: OnboardingAnswers) {
    const { user } = await api.post<{ user: SessionUser }>("/api/onboarding", {
      businessType: answers.businessType,
      industry: answers.industry,
      interestedCategories: answers.interestedCategories,
      preferredFabricTypes: answers.preferredFabricTypes,
      typicalOrderQuantity: answers.typicalOrderQuantity,
      budgetRange: answers.budgetRange,
      notes: (answers.notes as string) || undefined,
    });

    setUser(user);

    // Land on the catalog already filtered to their first stated interest —
    // the personalisation should be visible in the first second, not described.
    const first = (answers.interestedCategories as string[])[0];
    router.push(first ? `/products?category=${encodeURIComponent(first)}` : "/products");
    // The proxy decides on a token claim that just changed; refresh so the next
    // navigation is evaluated against the new cookie.
    router.refresh();
  }

  return (
    <ConversationalOnboarding
      greeting={[
        `Welcome to TextileMart, ${firstName}.`,
        "A few quick questions and I'll tune the catalog to what you actually buy. You can change any answer as we go.",
      ]}
      steps={STEPS}
      initial={toAnswers(preferences)}
      reviewTitle="That's everything. Here's what I've got —"
      finishLabel="Looks right — start browsing"
      onSubmit={submit}
    />
  );
}

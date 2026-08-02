"use client";

import { useRouter } from "next/navigation";
import {
  ConversationalOnboarding,
  type OnboardingAnswers,
  type OnboardingStep,
} from "@/components/onboarding/ConversationalOnboarding";
import { api } from "@/lib/api-client";
import {
  BUSINESS_TYPES,
  FABRIC_TYPES,
  OPERATING_HOURS_PRESETS,
  PRODUCT_CATEGORIES,
  type OperatingHoursPreset,
} from "@/server/constants/marketplace";
import { useSession } from "@/store/session";
import type { SessionUser } from "@/types";

/**
 * Supplier onboarding — the same guided chat as the buyer side, collecting the
 * business profile a supplier needs before they can list anything. The profile
 * is created here rather than lazily on first product, so the inventory screens
 * can assume it exists.
 */

const HOURS_OPTIONS = Object.values(OPERATING_HOURS_PRESETS).map((p) => p.label);
const HOURS_KEY_BY_LABEL = Object.fromEntries(
  Object.entries(OPERATING_HOURS_PRESETS).map(([key, p]) => [p.label, key]),
) as Record<string, OperatingHoursPreset>;

const PHONE = /^[0-9+\-\s()]{7,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN = /^[0-9]{6}$/;

export type SupplierProfilePrefill = {
  businessName?: string;
  businessType?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  categories?: string[];
  fabricTypes?: string[];
  minimumOrderQuantity?: number;
} | null;

function buildSteps(accountEmail: string, accountPhone: string): OnboardingStep[] {
  return [
    {
      id: "businessName",
      kind: "text",
      label: "Business",
      prompt: "Let's get your storefront live. What's the business called?",
      help: "This is the name buyers see on every product you list.",
      placeholder: "Meridian Mills",
    },
    {
      id: "businessType",
      kind: "single",
      label: "Type",
      prompt: "And what kind of operation is it?",
      options: BUSINESS_TYPES,
    },
    {
      id: "contact",
      kind: "form",
      label: "Contact",
      prompt: "How should buyers reach you about orders?",
      fields: [
        {
          name: "contactEmail",
          label: "Orders email",
          placeholder: accountEmail,
          half: true,
          inputMode: "email",
          autoComplete: "email",
          validate: (v) => (EMAIL.test(v) ? null : "Enter a valid email address"),
        },
        {
          name: "contactPhone",
          label: "Phone",
          placeholder: accountPhone || "+91 98450 00000",
          half: true,
          inputMode: "tel",
          autoComplete: "tel",
          validate: (v) => (PHONE.test(v) ? null : "Enter a valid phone number"),
        },
        {
          name: "website",
          label: "Website",
          placeholder: "meridianmills.in",
          optional: true,
        },
      ],
    },
    {
      id: "address",
      kind: "form",
      label: "Address",
      prompt: "Where do you ship from?",
      help: "Buyers filter by region, so this affects how often you turn up in results.",
      fields: [
        {
          name: "line1",
          label: "Address",
          placeholder: "14 Mill Road, Industrial Estate",
          autoComplete: "address-line1",
        },
        {
          name: "line2",
          label: "Address line 2",
          optional: true,
          autoComplete: "address-line2",
        },
        {
          name: "city",
          label: "City",
          placeholder: "Coimbatore",
          half: true,
          autoComplete: "address-level2",
        },
        {
          name: "state",
          label: "State",
          placeholder: "Tamil Nadu",
          half: true,
          autoComplete: "address-level1",
        },
        {
          name: "postalCode",
          label: "PIN code",
          placeholder: "641001",
          half: true,
          inputMode: "numeric",
          autoComplete: "postal-code",
          validate: (v) => (PIN.test(v) ? null : "Enter a 6-digit PIN code"),
        },
      ],
    },
    {
      id: "operatingHours",
      kind: "single",
      label: "Hours",
      prompt: "When are you open for orders?",
      help: "You can set per-day hours later in your business profile.",
      options: HOURS_OPTIONS,
    },
    {
      id: "categories",
      kind: "multi",
      label: "Categories",
      prompt: "What do you make or stock?",
      help: "These are the categories your listings will be discoverable under.",
      options: PRODUCT_CATEGORIES,
      min: 1,
    },
    {
      id: "fabricTypes",
      kind: "multi",
      label: "Construction",
      prompt: "Which constructions do you offer?",
      options: FABRIC_TYPES,
    },
    {
      id: "minimumOrderQuantity",
      kind: "text",
      label: "MOQ",
      prompt: "What's your minimum order quantity?",
      help: "In your usual selling unit. Individual products can override this.",
      placeholder: "500",
      inputMode: "numeric",
      validate: (v) => {
        const n = Number(v);
        return Number.isInteger(n) && n >= 1 && n <= 100000
          ? null
          : "Enter a whole number of at least 1";
      },
    },
    {
      id: "description",
      kind: "text",
      label: "About",
      prompt: "Last one — how would you describe the business to a new buyer?",
      help: "A couple of lines on what you specialise in. This shows on your storefront.",
      placeholder:
        "Third-generation mill in Coimbatore specialising in combed cotton shirting and GOTS-certified organic knits…",
      optional: true,
      multiline: true,
    },
  ];
}

/**
 * Seeds the chat. Contact details fall back to the account's own email and
 * phone, since re-typing what they just registered with is pure friction.
 */
function toAnswers(
  profile: SupplierProfilePrefill,
  accountEmail: string,
  accountPhone: string,
): OnboardingAnswers {
  return {
    businessName: profile?.businessName ?? "",
    businessType: profile?.businessType ?? "",
    contact: {
      contactEmail: profile?.contactEmail ?? accountEmail,
      contactPhone: profile?.contactPhone ?? accountPhone,
      website: profile?.website ?? "",
    },
    address: {
      line1: profile?.address?.line1 ?? "",
      line2: profile?.address?.line2 ?? "",
      city: profile?.address?.city ?? "",
      state: profile?.address?.state ?? "",
      postalCode: profile?.address?.postalCode ?? "",
    },
    // Stored hours are a full per-day grid, which no longer maps cleanly back
    // onto a preset — so editing re-confirms this one rather than guessing.
    operatingHours: "",
    categories: profile?.categories ?? [],
    fabricTypes: profile?.fabricTypes ?? [],
    minimumOrderQuantity: String(profile?.minimumOrderQuantity ?? ""),
    description: profile?.description ?? "",
  };
}

export function SupplierOnboarding({
  firstName,
  accountEmail,
  accountPhone,
  profile,
}: {
  firstName: string;
  accountEmail: string;
  accountPhone: string;
  profile: SupplierProfilePrefill;
}) {
  const router = useRouter();
  const setUser = useSession((s) => s.setUser);

  async function submit(answers: OnboardingAnswers) {
    const contact = answers.contact as Record<string, string>;
    const address = answers.address as Record<string, string>;

    const { user } = await api.post<{ user: SessionUser }>(
      "/api/supplier/onboarding",
      {
        businessName: answers.businessName,
        businessType: answers.businessType,
        description: (answers.description as string) || undefined,
        contactEmail: contact.contactEmail,
        contactPhone: contact.contactPhone,
        website: contact.website || undefined,
        address: {
          line1: address.line1,
          line2: address.line2 || undefined,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
        },
        operatingHours: HOURS_KEY_BY_LABEL[answers.operatingHours as string],
        categories: answers.categories,
        fabricTypes: answers.fabricTypes,
        minimumOrderQuantity: answers.minimumOrderQuantity,
      },
    );

    setUser(user);
    router.push("/supplier");
    router.refresh();
  }

  return (
    <ConversationalOnboarding
      greeting={[
        `Good to have you, ${firstName}.`,
        "I'll set up your business profile so you can start listing. This takes about two minutes and you can change any of it later.",
      ]}
      steps={buildSteps(accountEmail, accountPhone)}
      initial={toAnswers(profile, accountEmail, accountPhone)}
      reviewTitle="Here's your profile before I publish it —"
      finishLabel="Create my storefront"
      onSubmit={submit}
    />
  );
}

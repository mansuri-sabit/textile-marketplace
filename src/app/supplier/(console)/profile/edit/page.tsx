import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  BusinessProfileForm,
  type BusinessProfileValues,
} from "@/components/supplier/BusinessProfileForm";
import { getSession } from "@/server/middleware/session";
import { getSupplierProfile } from "@/server/services/supplier.service";
import { serialize } from "@/lib/serialize";

export const metadata: Metadata = {
  title: "Edit business profile",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type StoredProfile = {
  businessName: string;
  businessType?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: Partial<Record<"line1" | "line2" | "city" | "state" | "postalCode" | "country", string>>;
  operatingHours?: Partial<
    Record<(typeof DAYS)[number], { open?: string; close?: string; closed?: boolean }>
  >;
  categories?: string[];
  fabricTypes?: string[];
  minimumOrderQuantity?: number;
  gstNumber?: string;
  yearEstablished?: number;
};

function toFormValues(p: StoredProfile): BusinessProfileValues {
  return {
    businessName: p.businessName ?? "",
    businessType: p.businessType ?? "",
    description: p.description ?? "",
    contactEmail: p.contactEmail ?? "",
    contactPhone: p.contactPhone ?? "",
    website: p.website ?? "",
    address: {
      line1: p.address?.line1 ?? "",
      line2: p.address?.line2 ?? "",
      city: p.address?.city ?? "",
      state: p.address?.state ?? "",
      postalCode: p.address?.postalCode ?? "",
      country: p.address?.country ?? "India",
    },
    operatingHours: Object.fromEntries(
      DAYS.map((day) => [
        day,
        {
          open: p.operatingHours?.[day]?.open ?? "09:00",
          close: p.operatingHours?.[day]?.close ?? "18:00",
          closed: p.operatingHours?.[day]?.closed ?? false,
        },
      ]),
    ) as BusinessProfileValues["operatingHours"],
    categories: p.categories ?? [],
    fabricTypes: p.fabricTypes ?? [],
    minimumOrderQuantity: String(p.minimumOrderQuantity ?? 1),
    gstNumber: p.gstNumber ?? "",
    yearEstablished: p.yearEstablished ? String(p.yearEstablished) : "",
  };
}

export default async function EditBusinessProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fsupplier%2Fprofile%2Fedit");

  const profile = serialize<StoredProfile>(await getSupplierProfile(session.sub));

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/supplier/profile"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Business profile
      </Link>

      <header className="mb-8 mt-4">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">
          Edit business profile
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          This is what buyers see on your storefront and on every product page.
        </p>
      </header>

      <BusinessProfileForm initial={toFormValues(profile)} />
    </div>
  );
}

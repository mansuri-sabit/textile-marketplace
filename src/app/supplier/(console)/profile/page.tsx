import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Pencil,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { getSession } from "@/server/middleware/session";
import { getSupplierProfile } from "@/server/services/supplier.service";
import { serialize } from "@/lib/serialize";

export const metadata: Metadata = {
  title: "Business profile",
  description: "The details buyers see on your storefront and product pages.",
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

type DayHours = { open?: string; close?: string; closed?: boolean };

type Profile = {
  businessName: string;
  slug: string;
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
    country?: string;
  };
  operatingHours?: Partial<Record<(typeof DAYS)[number], DayHours>>;
  categories?: string[];
  fabricTypes?: string[];
  minimumOrderQuantity?: number;
  gstNumber?: string;
  yearEstablished?: number;
  verified?: boolean;
  rating?: number;
  ratingCount?: number;
};

/**
 * Read view of the business profile. Editing reuses the onboarding chat rather
 * than duplicating a second form over the same fields — one place where the
 * profile shape is expressed, so the two cannot disagree.
 */
export default async function SupplierProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fsupplier%2Fprofile");

  const profile = serialize<Profile>(await getSupplierProfile(session.sub));

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-3xl text-ink sm:text-4xl">
            <span className="truncate">{profile.businessName}</span>
            {profile.verified && (
              <BadgeCheck
                className="size-6 shrink-0 text-indigo-500"
                aria-label="Verified supplier"
              />
            )}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {profile.businessType}
            {profile.yearEstablished && ` · established ${profile.yearEstablished}`}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <Link
            href={`/products?supplier=${profile.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            View as a buyer
            <ExternalLink className="size-3.5" />
          </Link>
          <Link
            href="/supplier/profile/edit"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 underline-offset-2 hover:underline"
          >
            <Pencil className="size-3.5" />
            Edit
          </Link>
        </div>
      </header>

      {profile.description && (
        <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-ink">About</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            {profile.description}
          </p>
        </section>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Contact</h2>
          <div className="mt-3 space-y-2.5 text-sm">
            {profile.contactEmail && (
              <a
                href={`mailto:${profile.contactEmail}`}
                className="flex items-center gap-2 text-ink-muted hover:text-indigo-600"
              >
                <Mail className="size-4 shrink-0 text-ink-subtle" />
                <span className="truncate">{profile.contactEmail}</span>
              </a>
            )}
            {profile.contactPhone && (
              <a
                href={`tel:${profile.contactPhone}`}
                className="flex items-center gap-2 text-ink-muted hover:text-indigo-600"
              >
                <Phone className="size-4 shrink-0 text-ink-subtle" />
                {profile.contactPhone}
              </a>
            )}
            {profile.website && (
              <a
                href={
                  profile.website.startsWith("http")
                    ? profile.website
                    : `https://${profile.website}`
                }
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 text-ink-muted hover:text-indigo-600"
              >
                <ExternalLink className="size-4 shrink-0 text-ink-subtle" />
                <span className="truncate">{profile.website}</span>
              </a>
            )}
          </div>
        </section>

        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <MapPin className="size-4 text-ink-subtle" />
            Ships from
          </h2>
          <address className="mt-3 text-sm not-italic leading-relaxed text-ink-muted">
            {profile.address?.line1}
            {profile.address?.line2 && (
              <>
                <br />
                {profile.address.line2}
              </>
            )}
            <br />
            {profile.address?.city}, {profile.address?.state}{" "}
            {profile.address?.postalCode}
            <br />
            {profile.address?.country ?? "India"}
          </address>
        </section>

        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Clock className="size-4 text-ink-subtle" />
            Open for orders
          </h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            {DAYS.map((day) => {
              const hours = profile.operatingHours?.[day];
              return (
                <div key={day} className="flex items-baseline justify-between gap-3">
                  <dt className="capitalize text-ink-muted">{day.slice(0, 3)}</dt>
                  <dd className="text-ink tnum">
                    {hours?.closed ? (
                      <span className="text-ink-subtle">Closed</span>
                    ) : (
                      `${hours?.open ?? "09:00"} – ${hours?.close ?? "18:00"}`
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>

        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Trading</h2>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-muted">Business MOQ</dt>
              <dd className="text-ink tnum">
                {profile.minimumOrderQuantity ?? 1}
              </dd>
            </div>
            {profile.gstNumber && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">GST</dt>
                <dd className="text-ink">{profile.gstNumber}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-muted">Rating</dt>
              <dd className="text-ink tnum">
                {profile.rating
                  ? `${profile.rating.toFixed(1)} (${profile.ratingCount ?? 0})`
                  : "Not rated yet"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-subtle">
            Individual listings can set a tighter MOQ than the business default.
          </p>
        </section>
      </div>

      <section className="mt-4 rounded-card border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-ink">What you supply</h2>

        {profile.categories?.length ? (
          <>
            <p className="mt-4 mb-2 text-xs text-ink-subtle">Categories</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.categories.map((c) => (
                <Badge key={c} tone="indigo">
                  {c}
                </Badge>
              ))}
            </div>
          </>
        ) : null}

        {profile.fabricTypes?.length ? (
          <>
            <p className="mt-4 mb-2 text-xs text-ink-subtle">Construction</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.fabricTypes.map((f) => (
                <Badge key={f}>{f}</Badge>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

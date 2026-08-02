import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  Star,
} from "lucide-react";
import { ProductCard } from "@/components/buyer/ProductCard";
import { Badge, EmptyState, LinkButton } from "@/components/ui";
import { AppError } from "@/server/lib/api";
import { getSupplierStorefront } from "@/server/services/supplier.service";
import { serialize } from "@/lib/serialize";
import type { ProductCard as ProductCardType } from "@/types";

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

type Storefront = {
  supplier: {
    businessName: string;
    slug: string;
    businessType?: string;
    description?: string;
    contactEmail?: string;
    contactPhone?: string;
    website?: string;
    address?: { city?: string; state?: string };
    operatingHours?: Partial<
      Record<(typeof DAYS)[number], { open?: string; close?: string; closed?: boolean }>
    >;
    categories?: string[];
    fabricTypes?: string[];
    minimumOrderQuantity?: number;
    yearEstablished?: number;
    verified?: boolean;
    rating?: number;
    ratingCount?: number;
  };
  products: ProductCardType[];
  productCount: number;
};

async function load(slug: string): Promise<Storefront> {
  try {
    return serialize<Storefront>(await getSupplierStorefront(slug));
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { supplier, productCount } = await load(slug);

  return {
    title: supplier.businessName,
    description:
      supplier.description ??
      `${supplier.businessName} lists ${productCount} fabrics on TextileMart.`,
  };
}

/**
 * Public supplier storefront.
 *
 * Both the homepage and every product page have always linked here — this page
 * not existing meant a 404 on the two most travelled routes in the buyer
 * journey. The catalog below is the same `ProductCard` used by the grid, so a
 * fabric looks identical wherever a buyer meets it.
 */
export default async function SupplierStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { supplier, products, productCount } = await load(slug);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/suppliers"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        All suppliers
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-3xl text-ink sm:text-4xl">
            <span className="truncate">{supplier.businessName}</span>
            {supplier.verified && (
              <BadgeCheck
                className="size-6 shrink-0 text-indigo-500"
                aria-label="Verified supplier"
              />
            )}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            {supplier.businessType && <span>{supplier.businessType}</span>}
            {supplier.address?.city && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {supplier.address.city}
                {supplier.address.state && `, ${supplier.address.state}`}
              </span>
            )}
            {supplier.yearEstablished && <span>Since {supplier.yearEstablished}</span>}
            {Boolean(supplier.rating) && (
              <span className="flex items-center gap-1 tnum">
                <Star className="size-3.5 fill-amber-500 text-amber-500" />
                {supplier.rating?.toFixed(1)}
                {supplier.ratingCount ? ` (${supplier.ratingCount})` : ""}
              </span>
            )}
          </div>

          {supplier.description && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted">
              {supplier.description}
            </p>
          )}

          {supplier.categories?.length ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {supplier.categories.map((c) => (
                <Link key={c} href={`/products?category=${encodeURIComponent(c)}`}>
                  <Badge tone="indigo">{c}</Badge>
                </Link>
              ))}
              {supplier.fabricTypes?.map((f) => <Badge key={f}>{f}</Badge>)}
            </div>
          ) : null}
        </div>

        <aside className="w-full shrink-0 space-y-3 rounded-card border border-line bg-surface p-5 sm:w-72">
          <div className="space-y-2 text-sm">
            {supplier.contactEmail && (
              <a
                href={`mailto:${supplier.contactEmail}`}
                className="flex items-center gap-2 text-ink-muted hover:text-indigo-600"
              >
                <Mail className="size-4 shrink-0 text-ink-subtle" />
                <span className="truncate">{supplier.contactEmail}</span>
              </a>
            )}
            {supplier.contactPhone && (
              <a
                href={`tel:${supplier.contactPhone}`}
                className="flex items-center gap-2 text-ink-muted hover:text-indigo-600"
              >
                <Phone className="size-4 shrink-0 text-ink-subtle" />
                {supplier.contactPhone}
              </a>
            )}
            {supplier.website && (
              <a
                href={
                  supplier.website.startsWith("http")
                    ? supplier.website
                    : `https://${supplier.website}`
                }
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 text-ink-muted hover:text-indigo-600"
              >
                <ExternalLink className="size-4 shrink-0 text-ink-subtle" />
                <span className="truncate">{supplier.website}</span>
              </a>
            )}
          </div>

          <div className="border-t border-line pt-3">
            <p className="flex items-center gap-2 text-xs font-medium text-ink">
              <Clock className="size-3.5 text-ink-subtle" />
              Open for orders
            </p>
            <dl className="mt-2 space-y-1 text-xs">
              {DAYS.map((day) => {
                const hours = supplier.operatingHours?.[day];
                return (
                  <div key={day} className="flex justify-between gap-3">
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
          </div>

          <p className="border-t border-line pt-3 text-xs text-ink-subtle tnum">
            Business minimum order: {supplier.minimumOrderQuantity ?? 1}
          </p>
        </aside>
      </header>

      <section className="mt-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-2xl text-ink">
            {productCount} {productCount === 1 ? "fabric" : "fabrics"}
          </h2>
          {productCount > products.length && (
            <Link
              href={`/products?supplier=${supplier.slug}`}
              className="text-sm text-indigo-600 underline-offset-2 hover:underline"
            >
              See all with filters
            </Link>
          )}
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon={<PackageSearch className="size-6" />}
            title="Nothing listed yet"
            description="This supplier has not published any fabric."
            action={
              <LinkButton href="/products" variant="secondary">
                Browse the catalog
              </LinkButton>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((product, i) => (
              <ProductCard key={product._id} product={product} priority={i < 4} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ChevronRight, MapPin, Package, Star } from "lucide-react";
import { AskAboutProduct } from "@/components/ai/AskAboutProduct";
import { AddToCart } from "@/components/buyer/AddToCart";
import { ProductCard } from "@/components/buyer/ProductCard";
import { ProductGallery } from "@/components/buyer/ProductGallery";
import { Badge, Card, SectionHeading } from "@/components/ui";
import { AppError } from "@/server/lib/api";
import {
  getProductBySlug,
  getSimilarProducts,
} from "@/server/services/product.service";
import { serialize } from "@/lib/serialize";
import { formatPrice } from "@/lib/cn";
import type { ProductCard as ProductCardType, ProductDetail } from "@/types";

export const revalidate = 60;

async function load(slug: string) {
  try {
    const [product, similar] = await Promise.all([
      getProductBySlug(slug),
      getSimilarProducts(slug, 4),
    ]);
    return serialize<{ product: ProductDetail; similar: ProductCardType[] }>({
      product,
      similar,
    });
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
  try {
    const product = await getProductBySlug(slug);
    return {
      title: product.name,
      description: product.description.slice(0, 160),
      openGraph: { images: product.images?.[0] ? [product.images[0]] : [] },
    };
  } catch {
    return { title: "Fabric" };
  }
}

const SPEC_ROWS: Array<{ key: string; label: string; suffix?: string }> = [
  { key: "composition", label: "Composition" },
  { key: "gsm", label: "Weight", suffix: " GSM" },
  { key: "widthInches", label: "Width", suffix: '"' },
  { key: "weave", label: "Weave" },
  { key: "finish", label: "Finish" },
  { key: "shrinkage", label: "Shrinkage" },
  { key: "careInstructions", label: "Care" },
];

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { product, similar } = await load(slug);

  const specs = product.specifications ?? {};
  const soldOut = product.status === "out_of_stock" || product.stock === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-ink-subtle">
        <Link href="/products" className="transition-colors hover:text-ink">
          Fabrics
        </Link>
        <ChevronRight className="size-3" />
        <Link
          href={`/products?category=${encodeURIComponent(product.category)}`}
          className="transition-colors hover:text-ink"
        >
          {product.category}
        </Link>
        <ChevronRight className="size-3" />
        <span className="truncate text-ink-muted">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery
          images={product.images}
          alt={product.name}
          credits={product.imageCredits}
        />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{product.category}</Badge>
            <Badge tone="neutral">{product.fabricType}</Badge>
            {product.featured && <Badge tone="indigo">Featured</Badge>}
            {soldOut && <Badge tone="rose">Out of stock</Badge>}
          </div>

          <h1 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            {Boolean(product.rating) && (
              <span className="flex items-center gap-1 text-ink-muted tnum">
                <Star className="size-4 fill-amber-500 text-amber-500" />
                {product.rating?.toFixed(1)}
                <span className="text-ink-subtle">({product.ratingCount})</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-ink-muted tnum">
              <Package className="size-4" />
              {product.orderCount ?? 0} orders
            </span>
          </div>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-display text-4xl text-ink tnum">
              {formatPrice(product.pricePerUnit)}
            </span>
            <span className="text-sm text-ink-muted">per {product.unit}</span>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-ink-muted">
            {product.description}
          </p>

          {specs.certifications && specs.certifications.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {specs.certifications.map((c) => (
                <Badge key={c} tone="moss">
                  <BadgeCheck className="size-3" />
                  {c}
                </Badge>
              ))}
            </div>
          )}

          <hr className="my-7 border-line" />

          <AddToCart product={product} />

          <div className="mt-7">
            <AskAboutProduct slug={product.slug} />
          </div>

          <Link
            href={`/suppliers/${product.supplier.slug}`}
            className="mt-7 flex items-start gap-3 rounded-card border border-line bg-surface p-4 transition-colors hover:border-line-strong"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-600">
              {product.supplier.businessName.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium text-ink">
                  {product.supplier.businessName}
                </span>
                {product.supplier.verified && (
                  <BadgeCheck className="size-4 shrink-0 text-indigo-500" />
                )}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-subtle">
                {product.supplier.address?.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {product.supplier.address.city}, {product.supplier.address.state}
                  </span>
                )}
                {product.supplier.yearEstablished && (
                  <span className="tnum">Since {product.supplier.yearEstablished}</span>
                )}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 self-center text-ink-subtle" />
          </Link>
        </div>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-ink">Specifications</h2>
          <dl className="mt-4 divide-y divide-line">
            {SPEC_ROWS.map((row) => {
              const value = specs[row.key as keyof typeof specs];
              if (value === undefined || value === null || value === "") return null;
              return (
                <div key={row.key} className="flex justify-between gap-6 py-2.5">
                  <dt className="text-sm text-ink-subtle">{row.label}</dt>
                  <dd className="text-right text-sm text-ink">
                    {String(value)}
                    {row.suffix}
                  </dd>
                </div>
              );
            })}
            <div className="flex justify-between gap-6 py-2.5">
              <dt className="text-sm text-ink-subtle">Minimum order</dt>
              <dd className="text-right text-sm text-ink tnum">
                {product.minimumOrderQuantity} {product.unit}
              </dd>
            </div>
          </dl>
        </Card>

        {product.bulkTiers?.length > 0 && (
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-ink">Volume pricing</h2>
            <p className="mt-1 text-xs text-ink-subtle">
              Applied automatically once the quantity qualifies.
            </p>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-subtle">
                  <th className="pb-2 font-medium">Quantity</th>
                  <th className="pb-2 text-right font-medium">Price per {product.unit}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="py-2.5 text-ink-muted tnum">
                    {product.minimumOrderQuantity}+ {product.unit}
                  </td>
                  <td className="py-2.5 text-right text-ink tnum">
                    {formatPrice(product.pricePerUnit)}
                  </td>
                </tr>
                {product.bulkTiers.map((tier) => (
                  <tr key={tier.minQuantity}>
                    <td className="py-2.5 text-ink-muted tnum">
                      {tier.minQuantity}+ {product.unit}
                    </td>
                    <td className="py-2.5 text-right font-medium text-moss-600 tnum">
                      {formatPrice(tier.pricePerUnit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <SectionHeading
            eyebrow="Related"
            title="Similar fabrics"
            description="Matched on construction and end use, not just category."
          />
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {similar.map((item) => (
              <ProductCard key={item._id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

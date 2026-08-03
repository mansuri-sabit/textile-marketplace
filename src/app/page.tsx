import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  Grid2x2,
  Layers,
  MapPin,
  Ruler,
  Store,
  Truck,
  Users,
} from "lucide-react";
import {
  BestsellerCarousel,
  type Bestseller,
} from "@/components/buyer/BestsellerCarousel";
import { ProductCard } from "@/components/buyer/ProductCard";
import { HeroSearch } from "@/components/buyer/HeroSearch";
import { Badge, LinkButton, SectionHeading } from "@/components/ui";
import { PRODUCT_CATEGORIES } from "@/server/constants/marketplace";
import { connectDB } from "@/server/lib/db";
import { Product, SupplierProfile } from "@/server/models";
import { listProducts } from "@/server/services/product.service";
import { productQuerySchema } from "@/server/validators/product";
import { serialize } from "@/lib/serialize";
import { cdnImage } from "@/lib/image";
import { formatCompact } from "@/lib/cn";
import type { ProductCard as ProductCardType } from "@/types";

// The catalog changes when suppliers edit it, so the homepage is revalidated
// on a short interval rather than pinned at build time.
export const revalidate = 60;

type HomeSupplier = {
  slug: string;
  businessName: string;
  categories?: string[];
  address?: { city?: string; state?: string };
};

type HomeData = {
  featured: ProductCardType[];
  newest: ProductCardType[];
  bestsellers: Bestseller[];
  suppliers: HomeSupplier[];
  stats: { productCount: number; supplierCount: number };
  categories: Array<{ name: string; count: number; image: string }>;
};

/** Raw shape of the bestseller query, before the tier maths. */
type BestsellerRow = {
  _id: unknown;
  name: string;
  slug: string;
  images: string[];
  unit: string;
  pricePerUnit: number;
  bulkTiers?: Array<{ minQuantity: number; pricePerUnit: number }>;
};

/**
 * Ranks by `orderCount` — what buyers actually reordered — with rating as the
 * tie-break, and reports each fabric's cheapest volume tier as its saving. Out
 * of stock listings are excluded: a bestseller nobody can buy is an ad for a
 * dead end.
 */
function toBestseller(row: BestsellerRow): Bestseller {
  const cheapest = (row.bulkTiers ?? [])
    .filter((tier) => tier.pricePerUnit < row.pricePerUnit)
    .sort((a, b) => a.pricePerUnit - b.pricePerUnit)[0];

  return {
    _id: String(row._id),
    name: row.name,
    slug: row.slug,
    image: row.images[0] ?? "",
    unit: row.unit,
    pricePerUnit: row.pricePerUnit,
    bestPricePerUnit: cheapest?.pricePerUnit ?? row.pricePerUnit,
    bestPriceQuantity: cheapest?.minQuantity ?? 0,
    discountPercent: cheapest
      ? Math.round((1 - cheapest.pricePerUnit / row.pricePerUnit) * 100)
      : 0,
  };
}

async function getHomeData(): Promise<HomeData> {
  await connectDB();

  const [
    featured,
    newest,
    bestsellerRows,
    suppliers,
    productCount,
    supplierCount,
    categoryCounts,
  ] = await Promise.all([
    listProducts(productQuerySchema.parse({ featured: "true", limit: "8" })),
    listProducts(productQuerySchema.parse({ sort: "newest", limit: "4" })),
    Product.find({ status: "active", "images.0": { $exists: true } })
      .select("name slug images unit pricePerUnit bulkTiers")
      .sort({ orderCount: -1, rating: -1 })
      .limit(10)
      .lean<BestsellerRow[]>(),
    SupplierProfile.find({ verified: true })
      .select("businessName slug address.city address.state categories rating")
      .sort({ rating: -1 })
      .limit(6)
      .lean(),
    Product.countDocuments({ status: { $in: ["active", "out_of_stock"] } }),
    SupplierProfile.countDocuments(),
    Product.aggregate<{ _id: string; count: number }>([
      { $match: { status: { $in: ["active", "out_of_stock"] } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
  ]);

  // One representative image per category, so the tiles are photographic
  // rather than a wall of coloured rectangles.
  const covers = await Product.aggregate<{ _id: string; image: string }>([
    { $match: { status: "active", "images.0": { $exists: true } } },
    { $sort: { featured: -1, rating: -1 } },
    { $group: { _id: "$category", image: { $first: { $arrayElemAt: ["$images", 0] } } } },
  ]);
  const coverByCategory = new Map(covers.map((c) => [c._id, c.image]));
  const countByCategory = new Map(categoryCounts.map((c) => [c._id, c.count]));

  return serialize<HomeData>({
    featured: featured.products,
    newest: newest.products,
    bestsellers: bestsellerRows.map(toBestseller),
    suppliers,
    stats: { productCount, supplierCount },
    categories: PRODUCT_CATEGORIES.map((name) => ({
      name,
      count: countByCategory.get(name) ?? 0,
      image: coverByCategory.get(name) ?? "",
    })).filter((c) => c.count > 0),
  });
}

export default async function HomePage() {
  const { featured, newest, bestsellers, suppliers, stats, categories } =
    await getHomeData();

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        {/*
          A fixed brand photograph rather than a catalog listing — the hero
          should read the same on every revalidation instead of changing with
          whatever is featured today. It bleeds off the right edge and fades
          into the page, so the headline keeps its contrast without a scrim
          over the image. The focal point sits right of centre in the source,
          so the crop is nudged across to keep the fabric stack in frame.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] lg:block"
        >
          <Image
            src="/hero-fabrics.jpg"
            alt=""
            fill
            sizes="46vw"
            priority
            className="object-cover object-[62%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/55 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-paper to-transparent" />
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_15%_0%,var(--color-indigo-50),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="lg:max-w-[58%]">
            <Badge tone="indigo" className="mb-5">
              <Boxes className="size-3" />
              {formatCompact(stats.productCount)} fabrics from {stats.supplierCount} verified
              suppliers
            </Badge>

            <h1 className="font-display text-4xl leading-[1.08] text-ink sm:text-6xl">
              Source fabric the way
              <br className="hidden sm:block" /> you&rsquo;d describe it
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
              Mills, handloom collectives and converters in one catalog. Filter by
              construction, GSM and certification &mdash; or just say what you&rsquo;re
              making.
            </p>

            <div className="mt-9">
              <HeroSearch />
            </div>

            {/* The hero photograph is desktop-only. On phones and tablets it
                pushed the search box and the stats below the fold, and the
                catalog itself is the better first impression there. */}

            <dl className="mt-10 grid grid-cols-3 divide-x divide-line rounded-card border border-line bg-surface/70 backdrop-blur-sm">
              {[
                {
                  label: "Fabrics listed",
                  value: formatCompact(stats.productCount),
                  icon: <Layers className="size-4" />,
                },
                {
                  label: "Verified suppliers",
                  value: String(stats.supplierCount),
                  icon: <Users className="size-4" />,
                },
                {
                  label: "Textile clusters",
                  value: "8",
                  icon: <Grid2x2 className="size-4" />,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-3 px-3 py-4 sm:px-5"
                >
                  <span className="hidden size-10 shrink-0 place-items-center rounded-full bg-raised text-ink-muted sm:grid">
                    {stat.icon}
                  </span>
                  <span className="min-w-0">
                    <dd className="font-display text-2xl leading-none text-ink tnum sm:text-[28px]">
                      {stat.value}
                    </dd>
                    <dt className="mt-1.5 truncate text-[11px] text-ink-subtle sm:text-xs">
                      {stat.label}
                    </dt>
                  </span>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/*
        Straight after the hero, because it is the first thing a buyer landing
        cold can act on — a centred heading rather than the usual left-aligned
        SectionHeading, since the strip below it is full-width and symmetrical.
      */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-3xl text-ink sm:text-[40px]">
            Our Bestselling Products
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
            The qualities buyers reorder most, each shown with the volume price
            it unlocks.
          </p>
        </div>

        <div className="mt-10">
          <BestsellerCarousel products={bestsellers} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Browse"
          title="Shop by category"
          description="Every listing carries full construction data — composition, GSM, width, weave and finish."
        />

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.name}
              href={`/products?category=${encodeURIComponent(category.name)}`}
              className="group relative aspect-5/3 overflow-hidden rounded-card border border-line"
            >
              {category.image ? (
                <Image
                  src={cdnImage(category.image, { width: 400, height: 240 })}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="size-full bg-raised" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3.5">
                <p className="text-sm font-medium text-white">{category.name}</p>
                <p className="text-xs text-white/70 tnum">{category.count} fabrics</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Curated"
          title="Featured fabrics"
          description="Hand-picked qualities from mills and collectives across India."
          action={
            <LinkButton href="/products" variant="secondary" size="sm">
              View all
              <ArrowRight className="size-4" />
            </LinkButton>
          }
        />

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {featured.map((product, i) => (
            <ProductCard key={product._id} product={product} priority={i < 4} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: <Ruler className="size-5" />,
              title: "Specs, not guesswork",
              body: "Composition, GSM, width, weave, finish, shrinkage and certifications on every listing.",
            },
            {
              icon: <BadgeCheck className="size-5" />,
              title: "Verified mills",
              body: "Suppliers are listed with their GST details, cluster location and operating hours.",
            },
            {
              icon: <Truck className="size-5" />,
              title: "One order per supplier",
              body: "A mixed cart splits automatically, so each mill fulfils only what they make.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-card border border-line bg-surface p-6">
              <div className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                {item.icon}
              </div>
              <h3 className="mt-4 text-sm font-semibold text-ink">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Partners"
          title="Verified suppliers"
          description="Sourcing directly from the clusters each fabric family comes from."
          action={
            <LinkButton href="/suppliers" variant="secondary" size="sm">
              All suppliers
              <ArrowRight className="size-4" />
            </LinkButton>
          }
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((supplier) => (
            <Link
              key={supplier.slug}
              href={`/suppliers/${supplier.slug}`}
              className="group rounded-card border border-line bg-surface p-5 transition-all hover:border-line-strong hover:shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink group-hover:text-indigo-600">
                  {supplier.businessName}
                </h3>
                <BadgeCheck className="size-4 shrink-0 text-indigo-500" />
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-subtle">
                <MapPin className="size-3" />
                {supplier.address?.city}, {supplier.address?.state}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {supplier.categories?.slice(0, 3).map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-raised px-2 py-0.5 text-[11px] text-ink-muted"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Fresh" title="Recently listed" />
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {newest.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      </section>

      {/*
        The supplier pitch, closing the page the buyer journey opened.
        Left-aligned against a photograph rather than centred in an empty box:
        this is the one place on the homepage asking someone to sign up, and it
        has to carry as much weight as the catalog above it. Built on the
        indigo-50/900 pair because both flip with the theme — a fixed dark panel
        would need every colour restated for dark mode.
      */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-card border border-indigo-200 bg-indigo-50">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] lg:block"
          >
            <Image
              src="/auth-panel-fabrics.webp"
              alt=""
              fill
              sizes="46vw"
              className="object-cover"
            />
            {/* Fades the photograph into the panel so the copy keeps its
                contrast without a scrim laid over the whole image. */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-indigo-50/55 to-transparent" />
            <div className="absolute inset-0 bg-indigo-50/25" />
          </div>

          <div className="relative px-6 py-12 sm:px-10 sm:py-14 lg:max-w-[58%] lg:py-16">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600">
              <Store className="size-3" />
              For mills &amp; collectives
            </span>

            <h2 className="mt-5 font-display text-3xl leading-tight text-indigo-900 sm:text-[40px]">
              Sell on TextileMart
            </h2>

            <p className="mt-4 max-w-lg text-sm leading-relaxed text-indigo-600 sm:text-base">
              List your qualities once and take orders from brands sourcing
              directly &mdash; no enquiry forms, no middlemen. Setting up takes a
              few minutes.
            </p>

            <ul className="mt-8 grid gap-3.5 sm:max-w-lg">
              {[
                {
                  title: "List in minutes",
                  body: "Composition, GSM, weave, photos and bulk tiers on every listing.",
                },
                {
                  title: "Orders, not enquiries",
                  body: "A mixed cart splits by supplier, so you only ever see your own lines.",
                },
                {
                  title: "Your stock, your terms",
                  body: "Price, stock and order status stay under your control in one console.",
                },
              ].map((point) => (
                <li key={point.title} className="flex gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-indigo-600 text-white dark:bg-indigo-500 dark:text-indigo-50">
                    <Check className="size-3" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-indigo-900">
                      {point.title}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-indigo-600">
                      {point.body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-wrap gap-3">
              <LinkButton href="/register?role=supplier" size="lg">
                List your business
                <ArrowRight className="size-4" />
              </LinkButton>
              <LinkButton href="/suppliers" variant="secondary" size="lg">
                See who sells here
              </LinkButton>
            </div>

            <p className="mt-6 flex items-center gap-1.5 text-xs text-indigo-600/80">
              <BadgeCheck className="size-3.5 shrink-0" />
              {stats.supplierCount} verified suppliers already listing{" "}
              {formatCompact(stats.productCount)} fabrics.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

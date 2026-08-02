import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Boxes, MapPin, Ruler, Truck } from "lucide-react";
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
  suppliers: HomeSupplier[];
  stats: { productCount: number; supplierCount: number };
  categories: Array<{ name: string; count: number; image: string }>;
};

async function getHomeData(): Promise<HomeData> {
  await connectDB();

  const [featured, newest, suppliers, productCount, supplierCount, categoryCounts] =
    await Promise.all([
      listProducts(productQuerySchema.parse({ featured: "true", limit: "8" })),
      listProducts(productQuerySchema.parse({ sort: "newest", limit: "4" })),
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
  const { featured, newest, suppliers, stats, categories } = await getHomeData();

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,var(--color-indigo-50),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="flex flex-col items-center text-center">
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

            <div className="mt-9 flex w-full justify-center">
              <HeroSearch />
            </div>

            <dl className="mt-12 grid w-full max-w-2xl grid-cols-3 gap-4 border-t border-line pt-8">
              {[
                { label: "Fabrics listed", value: formatCompact(stats.productCount) },
                { label: "Verified suppliers", value: String(stats.supplierCount) },
                { label: "Textile clusters", value: "8" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dd className="font-display text-2xl text-ink tnum sm:text-3xl">
                    {stat.value}
                  </dd>
                  <dt className="mt-1 text-xs text-ink-subtle sm:text-sm">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>
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

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-card border border-indigo-200 bg-indigo-50 px-6 py-12 text-center sm:px-12">
          <h2 className="font-display text-3xl text-indigo-900">Sell on TextileMart</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-indigo-600">
            List your qualities, manage stock and take orders from brands sourcing
            directly. Setting up takes a few minutes.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkButton href="/register?role=supplier" size="lg">
              List your business
            </LinkButton>
            <LinkButton href="/suppliers" variant="secondary" size="lg">
              See who sells here
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}

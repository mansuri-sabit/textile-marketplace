import { Suspense } from "react";
import type { Metadata } from "next";
import { PackageSearch } from "lucide-react";
import { FilterPanel } from "@/components/buyer/FilterPanel";
import { ProductCard, ProductCardSkeleton } from "@/components/buyer/ProductCard";
import { Pagination, ResultsToolbar } from "@/components/buyer/ResultsToolbar";
import { EmptyState, LinkButton } from "@/components/ui";
import { getFacets, listProducts } from "@/server/services/product.service";
import { productQuerySchema } from "@/server/validators/product";
import { serialize } from "@/lib/serialize";
import type { Facets, ProductCard as ProductCardType, SearchMode } from "@/types";

export const metadata: Metadata = {
  title: "Browse fabrics",
  description:
    "Filter the catalog by category, construction, GSM, price and certification — or describe what you are making.",
};

// Results depend entirely on the query string, so this always renders fresh.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Results = {
  products: ProductCardType[];
  facets: Facets;
  total: number;
  page: number;
  pages: number;
  mode: SearchMode;
};

async function ProductResults({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );

  const query = productQuerySchema.parse(flat);

  // Facets are computed against the same filters, so each option's count
  // reflects what selecting it would actually return.
  const [listing, facets] = await Promise.all([listProducts(query), getFacets(query)]);

  const data = serialize<Results>({
    products: listing.products,
    facets,
    total: listing.total,
    page: listing.page,
    pages: listing.pages,
    mode: listing.mode,
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[248px_1fr]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <FilterPanel facets={data.facets} total={data.total} />
      </div>

      <div className="min-w-0">
        <ResultsToolbar total={data.total} mode={data.mode} query={query.q} />

        {data.products.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={<PackageSearch className="size-6" />}
            title="No fabrics match those filters"
            description={
              query.q
                ? `We could not find anything for “${query.q}”. Try describing the end use — for example, “lightweight cotton for summer dresses”.`
                : "Try widening the price or GSM range, or clearing a filter."
            }
            action={
              <LinkButton href="/products" variant="secondary">
                Clear all filters
              </LinkButton>
            }
          />
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {data.products.map((product, i) => (
                <ProductCard key={product._id} product={product} priority={i < 4} />
              ))}
            </div>
            <Pagination page={data.page} pages={data.pages} className="mt-10" />
          </>
        )}
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[248px_1fr]">
      <div className="hidden space-y-4 lg:block">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-8 w-full rounded-lg" />
            <div className="skeleton h-8 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Fabrics</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Every listing carries full construction data. Filter on the left, or search in
          plain language and let the catalog match on meaning.
        </p>
      </header>

      {/* Streams the shell immediately; results swap in when the query resolves. */}
      <Suspense fallback={<ResultsSkeleton />}>
        <ProductResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

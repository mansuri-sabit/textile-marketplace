import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackagePlus, PackageSearch } from "lucide-react";
import {
  InventoryRow,
  type InventoryProduct,
} from "@/components/supplier/InventoryRow";
import { EmptyState, LinkButton } from "@/components/ui";
import { getSession } from "@/server/middleware/session";
import { requireSupplierProfile, listSupplierProducts } from "@/server/services/supplier.service";
import { cn } from "@/lib/cn";
import { serialize } from "@/lib/serialize";

export const metadata: Metadata = {
  title: "Inventory",
  description: "Manage your listings, stock levels and availability.",
};

export const dynamic = "force-dynamic";

const FILTERS = [
  { value: undefined, label: "All" },
  { value: "active", label: "Live" },
  { value: "draft", label: "Unlisted" },
  { value: "out_of_stock", label: "Out of stock" },
];

type SearchParams = Promise<{ status?: string; q?: string; page?: string }>;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fsupplier%2Fproducts");

  const profile = await requireSupplierProfile(session.sub);
  const { status, q, page } = await searchParams;

  const valid = FILTERS.some((f) => f.value === status) ? status : undefined;

  const result = await listSupplierProducts(String(profile._id), {
    status: valid,
    q,
    page: Number(page) || 1,
    limit: 20,
  });
  const products = serialize<InventoryProduct[]>(result.products);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">Inventory</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {result.total} {result.total === 1 ? "listing" : "listings"}. Stock and
            availability are editable inline — the rest opens the full form.
          </p>
        </div>
        <LinkButton href="/supplier/products/new">
          <PackagePlus className="size-[18px]" />
          List a fabric
        </LinkButton>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <nav className="no-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((filter) => {
            const active = valid === filter.value;
            return (
              <Link
                key={filter.label}
                href={{
                  pathname: "/supplier/products",
                  query: {
                    ...(filter.value ? { status: filter.value } : {}),
                    ...(q ? { q } : {}),
                  },
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  active
                    ? "border-indigo-400 bg-indigo-50 font-medium text-indigo-600"
                    : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {filter.label}
              </Link>
            );
          })}
        </nav>

        {/* A plain GET form — search state belongs in the URL so it survives a
            refresh and can be shared. */}
        <form action="/supplier/products" className="ml-auto flex gap-2">
          {valid && <input type="hidden" name="status" value={valid} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search your listings…"
            aria-label="Search your listings"
            className="h-9 w-52 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </form>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="size-6" />}
          title={q ? `Nothing matches “${q}”` : "No listings yet"}
          description={
            q
              ? "Try a different name, tag or category."
              : "Add your first fabric and it becomes searchable — including by meaning, not just keywords."
          }
          action={
            <LinkButton href={q ? "/supplier/products" : "/supplier/products/new"}>
              {q ? "Clear search" : "List a fabric"}
            </LinkButton>
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {products.map((product) => (
            <InventoryRow key={product._id} product={product} />
          ))}
        </ul>
      )}

      {result.pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={{
                pathname: "/supplier/products",
                query: {
                  ...(valid ? { status: valid } : {}),
                  ...(q ? { q } : {}),
                  ...(p > 1 ? { page: p } : {}),
                },
              }}
              aria-current={p === result.page ? "page" : undefined}
              className={cn(
                "grid size-9 place-items-center rounded-lg border tnum",
                p === result.page
                  ? "border-indigo-400 bg-indigo-50 font-medium text-indigo-600"
                  : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {p}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

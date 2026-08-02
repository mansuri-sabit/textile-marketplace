import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPin, Star } from "lucide-react";
import { Badge, EmptyState, LinkButton } from "@/components/ui";
import { listSupplierDirectory } from "@/server/services/supplier.service";
import { serialize } from "@/lib/serialize";
import type { SupplierDirectoryEntry } from "@/types";

export const metadata: Metadata = {
  title: "Suppliers",
  description:
    "Mills, handloom collectives and converters listing on TextileMart — browse by specialisation and region.",
};

// Product counts move as suppliers list and sell, so this is never cached.
export const dynamic = "force-dynamic";

/**
 * The supplier directory. Linked from both the header and the footer, which is
 * why it needed to exist — those links were the last 404 on the buyer path.
 *
 * Cards open the catalog filtered to that supplier rather than a separate
 * storefront route: the filtered grid already carries every facet a buyer would
 * want, and one fewer surface is one fewer thing to keep consistent.
 */
export default async function SuppliersPage() {
  const suppliers = serialize<SupplierDirectoryEntry[]>(
    await listSupplierDirectory(),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Suppliers</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Every listing on TextileMart comes from one of these businesses. Open
          any of them to see their full catalog with construction data intact.
        </p>
      </header>

      {suppliers.length === 0 ? (
        <EmptyState
          title="No suppliers listing yet"
          description="Suppliers appear here once they publish their first fabric."
          action={
            <LinkButton href="/register?role=supplier" variant="secondary">
              List your business
            </LinkButton>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((supplier) => (
            <SupplierCard key={supplier._id} supplier={supplier} />
          ))}
        </div>
      )}
    </div>
  );
}

function SupplierCard({ supplier }: { supplier: SupplierDirectoryEntry }) {
  return (
    <Link
      href={`/products?supplier=${supplier.slug}`}
      className="group flex flex-col rounded-card border border-line bg-surface p-5 transition-all hover:border-line-strong hover:shadow-raised"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-base font-medium text-ink group-hover:text-indigo-600">
            <span className="truncate">{supplier.businessName}</span>
            {supplier.verified && (
              <BadgeCheck
                className="size-4 shrink-0 text-indigo-500"
                aria-label="Verified supplier"
              />
            )}
          </h2>
          {supplier.businessType && (
            <p className="mt-0.5 text-xs text-ink-subtle">{supplier.businessType}</p>
          )}
        </div>

        {Boolean(supplier.rating) && (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-ink-muted tnum">
            <Star className="size-3.5 fill-amber-500 text-amber-500" />
            {supplier.rating?.toFixed(1)}
          </span>
        )}
      </div>

      {supplier.address?.city && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-subtle">
          <MapPin className="size-3.5 shrink-0" />
          {supplier.address.city}
          {supplier.address.state && `, ${supplier.address.state}`}
        </p>
      )}

      {supplier.description && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-muted">
          {supplier.description}
        </p>
      )}

      {supplier.categories?.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {supplier.categories.slice(0, 3).map((category) => (
            <Badge key={category}>{category}</Badge>
          ))}
          {supplier.categories.length > 3 && (
            <Badge>+{supplier.categories.length - 3}</Badge>
          )}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between pt-5 text-sm">
        <span className="text-ink-muted tnum">
          {supplier.productCount}{" "}
          {supplier.productCount === 1 ? "fabric" : "fabrics"}
        </span>
        <span className="flex items-center gap-1 font-medium text-indigo-600">
          View catalog
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  IndianRupee,
  Package,
  PackagePlus,
  Receipt,
} from "lucide-react";
import { OrderStatusBadge } from "@/components/buyer/OrderStatus";
import { EmptyState, LinkButton } from "@/components/ui";
import { getSession } from "@/server/middleware/session";
import { supplierDashboard } from "@/server/services/order.service";
import { requireSupplierProfile } from "@/server/services/supplier.service";
import { cn, formatCompact, formatPrice, formatRelative } from "@/lib/cn";
import { cdnImage } from "@/lib/image";
import { serialize } from "@/lib/serialize";
import type { SupplierDashboard } from "@/types";

export const metadata: Metadata = {
  title: "Supplier dashboard",
  description: "Orders, inventory health and revenue at a glance.",
};

export const dynamic = "force-dynamic";

export default async function SupplierDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fsupplier");

  const profile = await requireSupplierProfile(session.sub);
  const data = serialize<SupplierDashboard>(
    await supplierDashboard(String(profile._id)),
  );

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">
            {profile.businessName}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {data.orders.pending > 0 ? (
              <>
                <span className="font-medium text-clay-600">
                  {data.orders.pending} order
                  {data.orders.pending === 1 ? "" : "s"} waiting on you
                </span>{" "}
                — confirm them to start the clock.
              </>
            ) : (
              "Nothing waiting on you right now."
            )}
          </p>
        </div>
        <LinkButton href="/supplier/products/new">
          <PackagePlus className="size-[18px]" />
          List a fabric
        </LinkButton>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          icon={<Receipt className="size-4" />}
          label="Pending orders"
          value={String(data.orders.pending)}
          tone={data.orders.pending > 0 ? "clay" : undefined}
          href="/supplier/orders?status=pending"
        />
        <Stat
          icon={<Boxes className="size-4" />}
          label="In progress"
          value={String(data.orders.inProgress)}
          href="/supplier/orders"
        />
        <Stat
          icon={<Package className="size-4" />}
          label="Active listings"
          value={`${data.products.active}/${data.products.total}`}
          href="/supplier/products"
        />
        <Stat
          icon={<IndianRupee className="size-4" />}
          label="Completed revenue"
          value={formatPrice(data.orders.revenue)}
        />
      </div>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl text-ink">Recent orders</h2>
            <Link
              href="/supplier/orders"
              className="text-sm text-indigo-600 underline-offset-2 hover:underline"
            >
              View all
            </Link>
          </div>

          {data.recentOrders.length === 0 ? (
            <EmptyState
              icon={<Receipt className="size-6" />}
              title="No orders yet"
              description="Once a buyer orders from your catalog it will appear here, newest first."
              action={
                <LinkButton href="/supplier/products" variant="secondary">
                  Check your listings
                </LinkButton>
              }
            />
          ) : (
            <div className="space-y-3">
              {data.recentOrders.map((order) => (
                <Link
                  key={order._id}
                  href={`/supplier/orders/${order.orderNumber}`}
                  className="group flex items-center gap-4 rounded-card border border-line bg-surface p-4 transition-colors hover:border-line-strong"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="font-mono text-sm font-medium text-ink group-hover:text-indigo-600">
                        {order.orderNumber}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-subtle">
                      {order.buyer?.name ?? "Buyer"} · {formatRelative(order.createdAt)} ·{" "}
                      {order.items.length}{" "}
                      {order.items.length === 1 ? "line" : "lines"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-ink tnum">
                    {formatPrice(order.total)}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-card border border-line bg-surface p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <AlertTriangle className="size-4 text-amber-500" />
              Inventory alerts
            </h2>

            {data.inventoryAlerts.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                Every listing is comfortably stocked.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-ink-subtle">
                  At or below 50 units — restock before they stop selling.
                </p>
                <ul className="mt-4 space-y-3">
                  {data.inventoryAlerts.map((item) => (
                    <li key={item._id}>
                      <Link
                        href={`/supplier/products/${item._id}/edit`}
                        className="group flex items-center gap-3"
                      >
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-raised">
                          {item.images?.[0] && (
                            <Image
                              src={cdnImage(item.images[0], { width: 100, height: 100 })}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink group-hover:text-indigo-600">
                            {item.name}
                          </p>
                          <p className="mt-0.5 text-xs tnum">
                            {item.stock === 0 ? (
                              <span className="font-medium text-rose-500">
                                Out of stock
                              </span>
                            ) : (
                              <span className="text-amber-500">
                                {item.stock} {item.unit} left
                              </span>
                            )}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="rounded-card border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold text-ink">Catalog</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row label="Total listings">{data.products.total}</Row>
              <Row label="Active">{data.products.active}</Row>
              <Row label="Out of stock">{data.products.outOfStock}</Row>
              <Row label="Stock value">
                {formatPrice(data.products.inventoryValue)}
              </Row>
            </dl>
            <p className="mt-4 text-xs text-ink-subtle">
              {formatCompact(data.orders.total)} orders received all time.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "clay";
  href?: string;
}) {
  const body = (
    <>
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
        {icon}
        {label}
      </span>
      <p
        className={cn(
          "mt-2 font-display text-2xl tnum",
          tone === "clay" ? "text-clay-600" : "text-ink",
        )}
      >
        {value}
      </p>
    </>
  );

  const className = cn(
    "block rounded-card border bg-surface p-4 transition-colors",
    tone === "clay" ? "border-clay-100" : "border-line",
    href && "hover:border-line-strong",
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink tnum">{children}</dd>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Receipt } from "lucide-react";
import { OrderStatusBadge } from "@/components/buyer/OrderStatus";
import { EmptyState, LinkButton } from "@/components/ui";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderStatus as ServerOrderStatus,
} from "@/server/constants/marketplace";
import { getSession } from "@/server/middleware/session";
import { listSupplierOrders } from "@/server/services/order.service";
import { requireSupplierProfile } from "@/server/services/supplier.service";
import { cn, formatPrice, formatRelative } from "@/lib/cn";
import { serialize } from "@/lib/serialize";
import type { Order } from "@/types";

export const metadata: Metadata = {
  title: "Incoming orders",
  description: "Confirm, prepare and dispatch the orders buyers have placed.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; page?: string }>;

export default async function SupplierOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fsupplier%2Forders");

  const profile = await requireSupplierProfile(session.sub);
  const { status: rawStatus, page: rawPage } = await searchParams;
  const status = ORDER_STATUSES.includes(rawStatus as ServerOrderStatus)
    ? (rawStatus as ServerOrderStatus)
    : undefined;

  const result = await listSupplierOrders(String(profile._id), {
    status,
    page: Number(rawPage) || 1,
  });
  const orders = serialize<Order[]>(result.orders);
  const counts: Record<string, number> = result.statusCounts;
  const total = Object.values(counts).reduce<number>((n, c) => n + c, 0);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Orders</h1>
        <p className="mt-2 text-sm text-ink-muted">
          You only ever see your own lines — a buyer&rsquo;s multi-supplier
          basket is split before it reaches you.
        </p>
      </header>

      <nav className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Tab href="/supplier/orders" active={!status} count={total}>
          All
        </Tab>
        {ORDER_STATUSES.map((s) => (
          <Tab
            key={s}
            href={`/supplier/orders?status=${s}`}
            active={status === s}
            count={counts[s] ?? 0}
          >
            {ORDER_STATUS_LABELS[s]}
          </Tab>
        ))}
      </nav>

      {orders.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-6" />}
          title={
            status
              ? `Nothing ${ORDER_STATUS_LABELS[status].toLowerCase()}`
              : "No orders yet"
          }
          description={
            status
              ? "Try another status tab."
              : "Orders land here the moment a buyer checks out with one of your fabrics."
          }
          action={
            <LinkButton
              href={status ? "/supplier/orders" : "/supplier/products"}
              variant="secondary"
            >
              {status ? "View all orders" : "Check your listings"}
            </LinkButton>
          }
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
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
                  {order.buyer?.name ?? "Buyer"}
                  {order.shippingAddress?.city && ` · ${order.shippingAddress.city}`}
                  {" · "}
                  {formatRelative(order.createdAt)}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-ink tnum">
                  {formatPrice(order.total)}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-subtle tnum">
                  {order.items.length}{" "}
                  {order.items.length === 1 ? "line" : "lines"}
                </p>
              </div>

              <ArrowRight className="size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}

      {result.pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={{
                pathname: "/supplier/orders",
                query: { ...(status ? { status } : {}), ...(p > 1 ? { page: p } : {}) },
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

function Tab({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active
          ? "border-indigo-400 bg-indigo-50 font-medium text-indigo-600"
          : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
      {count > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[11px] tnum",
            active ? "bg-indigo-100 text-indigo-600" : "bg-raised text-ink-subtle",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

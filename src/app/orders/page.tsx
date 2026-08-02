import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { OrderRow } from "@/components/buyer/OrderRow";
import { EmptyState, LinkButton } from "@/components/ui";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderStatus as ServerOrderStatus,
} from "@/server/constants/marketplace";
import { getSession } from "@/server/middleware/session";
import { listBuyerOrders } from "@/server/services/order.service";
import { cn } from "@/lib/cn";
import { serialize } from "@/lib/serialize";
import type { Order } from "@/types";

export const metadata: Metadata = {
  title: "Your orders",
  description: "Track current orders and review everything you've bought.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; page?: string }>;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Forders");
  if (session.role !== "buyer") redirect("/supplier/orders");

  const { status: rawStatus, page: rawPage } = await searchParams;
  const status = ORDER_STATUSES.includes(rawStatus as ServerOrderStatus)
    ? (rawStatus as ServerOrderStatus)
    : undefined;

  const result = await listBuyerOrders(session.sub, {
    status,
    page: Number(rawPage) || 1,
  });
  const orders = serialize<Order[]>(result.orders);

  const filters = [
    { value: undefined, label: "All" },
    ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] })),
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Your orders</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Each supplier confirms and fulfils their own order, so a single
          checkout can appear here as more than one line.
        </p>
      </header>

      {/* Horizontal scroll rather than a wrapping pile of chips on mobile. */}
      <nav className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {filters.map((filter) => {
          const active = status === filter.value;
          return (
            <Link
              key={filter.label}
              href={filter.value ? `/orders?status=${filter.value}` : "/orders"}
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

      {orders.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="size-6" />}
          title={status ? `No ${ORDER_STATUS_LABELS[status].toLowerCase()} orders` : "No orders yet"}
          description={
            status
              ? "Try another status, or view everything you've ordered."
              : "When you place your first order it will show up here with live status from the supplier."
          }
          action={
            <LinkButton href={status ? "/orders" : "/products"} variant="secondary">
              {status ? "View all orders" : "Browse fabrics"}
            </LinkButton>
          }
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderRow key={order._id} order={order} />
          ))}
        </div>
      )}

      {result.pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: result.pages }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              href={{
                pathname: "/orders",
                query: { ...(status ? { status } : {}), ...(page > 1 ? { page } : {}) },
              }}
              aria-current={page === result.page ? "page" : undefined}
              className={cn(
                "grid size-9 place-items-center rounded-lg border tnum",
                page === result.page
                  ? "border-indigo-400 bg-indigo-50 font-medium text-indigo-600"
                  : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {page}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

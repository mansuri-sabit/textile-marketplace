import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Package, Store } from "lucide-react";
import { OrderStatusBadge } from "@/components/buyer/OrderStatus";
import { LinkButton } from "@/components/ui";
import { getSession } from "@/server/middleware/session";
import { listBuyerOrders } from "@/server/services/order.service";
import { formatPrice } from "@/lib/cn";
import { cdnImage } from "@/lib/image";
import { serialize } from "@/lib/serialize";
import type { Order } from "@/types";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Confirmation is keyed on the checkout group rather than held in memory after
 * the POST, so it survives a refresh and can be returned to from an email link
 * later. The buyer id stays in the query, so the id in the URL is not a
 * capability — someone else's group reads as empty and 404s.
 */
export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "buyer") redirect("/supplier");

  const { groupId } = await params;
  const result = await listBuyerOrders(session.sub, {
    checkoutGroupId: groupId,
    limit: 50,
  });

  if (!result.orders.length) notFound();

  const orders = serialize<Order[]>(result.orders);
  const grandTotal = orders.reduce((sum, o) => sum + o.total, 0);
  const split = orders.length > 1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-moss-50 text-moss-600">
          <CheckCircle2 className="size-7" />
        </div>
        <h1 className="mt-5 font-display text-3xl text-ink sm:text-4xl">
          {split ? "Your orders are in" : "Your order is in"}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-ink-muted">
          {split
            ? `Because you bought from ${orders.length} suppliers, this went out as ${orders.length} separate orders. Each supplier confirms and dispatches their own.`
            : "The supplier has been notified and will confirm shortly. You can track progress from your orders page."}
        </p>
      </header>

      <div className="mt-8 space-y-4">
        {orders.map((order) => (
          <section
            key={order._id}
            className="overflow-hidden rounded-card border border-line bg-surface"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-raised/60 px-4 py-3">
              <div className="min-w-0">
                <Link
                  href={`/orders/${order.orderNumber}`}
                  className="font-mono text-sm font-medium text-ink hover:text-indigo-600"
                >
                  {order.orderNumber}
                </Link>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-subtle">
                  <Store className="size-3.5" />
                  {order.supplier?.businessName}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
            </header>

            <ul className="divide-y divide-line">
              {order.items.map((item, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-raised">
                    {item.image ? (
                      <Image
                        src={cdnImage(item.image, { width: 110, height: 110 })}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <Package className="absolute inset-0 m-auto size-4 text-ink-subtle" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{item.name}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle tnum">
                      {item.quantity} {item.unit} × {formatPrice(item.pricePerUnit)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-ink tnum">
                    {formatPrice(item.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-baseline justify-between border-t border-line px-4 py-3">
              <span className="text-sm text-ink-muted">Order total</span>
              <span className="text-sm font-semibold text-ink tnum">
                {formatPrice(order.total)}
              </span>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex items-baseline justify-between rounded-card border border-line bg-raised px-5 py-4">
        <span className="text-sm font-medium text-ink">
          {split ? "Total across all orders" : "Total"}
        </span>
        <span className="font-display text-2xl text-ink tnum">
          {formatPrice(grandTotal)}
        </span>
      </div>

      <div className="mt-6 rounded-card border border-line bg-surface p-5 text-sm">
        <p className="font-medium text-ink">Shipping to</p>
        <address className="mt-1.5 not-italic leading-relaxed text-ink-muted">
          {orders[0].shippingAddress.fullName}
          <br />
          {orders[0].shippingAddress.line1}
          {orders[0].shippingAddress.line2 && (
            <>
              <br />
              {orders[0].shippingAddress.line2}
            </>
          )}
          <br />
          {orders[0].shippingAddress.city}, {orders[0].shippingAddress.state}{" "}
          {orders[0].shippingAddress.postalCode}
          <br />
          {orders[0].shippingAddress.phone}
        </address>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <LinkButton href="/orders" size="lg">
          Track your orders
          <ArrowRight className="size-[18px]" />
        </LinkButton>
        <LinkButton href="/products" size="lg" variant="secondary">
          Keep browsing
        </LinkButton>
      </div>
    </div>
  );
}

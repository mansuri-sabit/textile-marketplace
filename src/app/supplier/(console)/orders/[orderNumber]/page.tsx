import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Package, Phone, ReceiptText } from "lucide-react";
import { OrderStatusBadge, OrderTimeline } from "@/components/buyer/OrderStatus";
import { OrderStatusControl } from "@/components/supplier/OrderStatusControl";
import { AppError } from "@/server/lib/api";
import { getSession } from "@/server/middleware/session";
import { getSupplierOrder } from "@/server/services/order.service";
import { requireSupplierProfile } from "@/server/services/supplier.service";
import { formatDate, formatPrice } from "@/lib/cn";
import { cdnImage } from "@/lib/image";
import { serialize } from "@/lib/serialize";
import type { Order } from "@/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Order ${orderNumber}`, robots: { index: false } };
}

export default async function SupplierOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const session = await getSession();
  const { orderNumber } = await params;
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/supplier/orders/${orderNumber}`)}`);
  }

  const profile = await requireSupplierProfile(session.sub);

  let raw;
  try {
    raw = await getSupplierOrder(String(profile._id), orderNumber);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }

  const order = serialize<Order>(raw);

  return (
    <div>
      <Link
        href="/supplier/orders"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        All orders
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-medium text-ink sm:text-3xl">
            {order.orderNumber}
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Placed {formatDate(order.createdAt)} · {order.items.length}{" "}
            {order.items.length === 1 ? "line" : "lines"} ·{" "}
            <span className="font-medium text-ink">{formatPrice(order.total)}</span>
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">Update status</h2>
            <OrderStatusControl
              orderNumber={order.orderNumber}
              status={order.status}
            />
          </section>

          <section className="overflow-hidden rounded-card border border-line bg-surface">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              To fulfil
            </h2>
            <ul className="divide-y divide-line">
              {order.items.map((item, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-raised">
                    {item.image ? (
                      <Image
                        src={cdnImage(item.image, { width: 140, height: 140 })}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <Package className="absolute inset-0 m-auto size-4 text-ink-subtle" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{item.name}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle tnum">
                      {item.color && `${item.color} · `}
                      {formatPrice(item.pricePerUnit)}/{item.unit}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg text-ink tnum">
                      {item.quantity}
                    </p>
                    <p className="text-[11px] text-ink-subtle">{item.unit}</p>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="space-y-2 border-t border-line px-4 py-4 text-sm">
              <Row label="Subtotal">{formatPrice(order.subtotal)}</Row>
              <Row label="GST (5%)">{formatPrice(order.taxAmount)}</Row>
              <div className="flex items-baseline justify-between border-t border-line pt-2.5">
                <dt className="font-medium text-ink">Order value</dt>
                <dd className="font-display text-xl text-ink tnum">
                  {formatPrice(order.total)}
                </dd>
              </div>
            </dl>
          </section>

          {order.buyerNote && (
            <section className="rounded-card border border-line bg-surface p-5">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <ReceiptText className="size-4 text-ink-subtle" />
                Note from the buyer
              </h2>
              <p className="text-sm leading-relaxed text-ink-muted">
                {order.buyerNote}
              </p>
            </section>
          )}

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink">History</h2>
            <OrderTimeline status={order.status} history={order.statusHistory} />
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Buyer</h2>
            <p className="text-sm font-medium text-ink">
              {order.buyer?.name ?? "Buyer"}
            </p>
            <div className="mt-3 space-y-1.5 text-xs">
              {order.buyer?.email && (
                <a
                  href={`mailto:${order.buyer.email}`}
                  className="flex items-center gap-2 text-ink-muted hover:text-indigo-600"
                >
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{order.buyer.email}</span>
                </a>
              )}
              {order.buyer?.phone && (
                <a
                  href={`tel:${order.buyer.phone}`}
                  className="flex items-center gap-2 text-ink-muted hover:text-indigo-600"
                >
                  <Phone className="size-3.5 shrink-0" />
                  {order.buyer.phone}
                </a>
              )}
            </div>
          </section>

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <MapPin className="size-4 text-ink-subtle" />
              Ship to
            </h2>
            <address className="text-sm not-italic leading-relaxed text-ink-muted">
              <span className="font-medium text-ink">
                {order.shippingAddress.fullName}
              </span>
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 && (
                <>
                  <br />
                  {order.shippingAddress.line2}
                </>
              )}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
              {order.shippingAddress.postalCode}
              <br />
              <a
                href={`tel:${order.shippingAddress.phone}`}
                className="hover:text-indigo-600"
              >
                {order.shippingAddress.phone}
              </a>
            </address>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink tnum">{children}</dd>
    </div>
  );
}

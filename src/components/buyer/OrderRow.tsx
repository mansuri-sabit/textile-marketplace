import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Package, Store } from "lucide-react";
import { OrderStatusBadge } from "@/components/buyer/OrderStatus";
import { cn, formatPrice, formatRelative } from "@/lib/cn";
import { cdnImage } from "@/lib/image";
import type { Order } from "@/types";

/**
 * One order, as it appears in a list. Shared by the buyer dashboard and the
 * orders page so a "current order" and a "past order" are never presented in
 * two different visual languages.
 */
export function OrderRow({
  order,
  className,
}: {
  order: Pick<
    Order,
    "orderNumber" | "status" | "total" | "createdAt" | "items"
  > & { supplier?: { businessName?: string } | null };
  className?: string;
}) {
  const shown = order.items.slice(0, 3);
  const extra = order.items.length - shown.length;

  return (
    <Link
      href={`/orders/${order.orderNumber}`}
      className={cn(
        "group flex items-center gap-4 rounded-card border border-line bg-surface p-4 transition-colors hover:border-line-strong",
        className,
      )}
    >
      <div className="flex -space-x-3">
        {shown.map((item, i) => (
          <div
            key={i}
            className="relative size-12 shrink-0 overflow-hidden rounded-lg border-2 border-surface bg-raised"
          >
            {item.image ? (
              <Image
                src={cdnImage(item.image, { width: 120, height: 120 })}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <Package className="absolute inset-0 m-auto size-4 text-ink-subtle" />
            )}
          </div>
        ))}
        {extra > 0 && (
          <span className="grid size-12 shrink-0 place-items-center rounded-lg border-2 border-surface bg-raised text-xs font-medium text-ink-muted tnum">
            +{extra}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-mono text-sm font-medium text-ink group-hover:text-indigo-600">
            {order.orderNumber}
          </span>
          <OrderStatusBadge status={order.status} />
        </div>

        <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-ink-subtle">
          <Store className="size-3.5 shrink-0" />
          <span className="truncate">{order.supplier?.businessName ?? "Supplier"}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{formatRelative(order.createdAt)}</span>
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-ink tnum">
          {formatPrice(order.total)}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-subtle tnum">
          {order.items.length} {order.items.length === 1 ? "line" : "lines"}
        </p>
      </div>

      <ChevronRight className="size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

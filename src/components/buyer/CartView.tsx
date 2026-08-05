"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Badge, Button, LinkButton, Skeleton } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { cn, formatPrice } from "@/lib/cn";
import { cdnBlur, cdnImage } from "@/lib/image";
import { useCart } from "@/store/cart";
import type { CartItem } from "@/types";

/**
 * The cart is rendered from the store rather than the server so the header
 * badge, the quantity steppers and the totals all move together. Every mutation
 * round-trips: bulk tiers mean the client cannot predict the new totals without
 * duplicating `pricing.ts`, and two copies of that logic would eventually
 * disagree.
 */
export function CartView() {
  const cart = useCart((s) => s.cart);
  const loading = useCart((s) => s.loading);
  const load = useCart((s) => s.load);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !cart.items.length) return <CartSkeleton />;

  if (!cart.items.length) {
    return (
      <div className="rounded-card border border-dashed border-line px-6 py-20 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-raised text-ink-subtle">
          <ShoppingBag className="size-6" />
        </div>
        <p className="text-base font-medium text-ink">Your cart is empty</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
          Browse the catalog by construction and GSM, or just describe what
          you&rsquo;re making and let the search match on meaning.
        </p>
        <LinkButton href="/products" className="mt-6">
          Browse fabrics
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-500"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        {cart.groups.length > 1 && (
          <p className="rounded-lg border border-line bg-raised px-4 py-3 text-sm text-ink-muted">
            You&rsquo;re buying from {cart.groups.length} suppliers, so this will
            be placed as {cart.groups.length} separate orders — each one tracked
            and fulfilled by its own supplier.
          </p>
        )}

        {cart.groups.map((group) => (
          <section
            key={group.supplier.id}
            className="overflow-hidden rounded-card border border-line bg-surface"
          >
            <header className="flex items-center justify-between gap-3 border-b border-line bg-raised/60 px-4 py-3">
              <Link
                href={`/products?supplier=${group.supplier.slug}`}
                className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink hover:text-indigo-600"
              >
                <Store className="size-4 shrink-0 text-ink-subtle" />
                <span className="truncate">{group.supplier.name}</span>
              </Link>
              <span className="shrink-0 text-sm text-ink-muted tnum">
                {formatPrice(group.subtotal)}
              </span>
            </header>

            <ul className="divide-y divide-line">
              {group.items.map((item) => (
                <CartLine
                  key={`${item.productId}-${item.color ?? ""}`}
                  item={item}
                  onError={setError}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <OrderSummary />
    </div>
  );
}

function CartLine({
  item,
  onError,
}: {
  item: CartItem;
  onError: (message: string | null) => void;
}) {
  const update = useCart((s) => s.update);
  const remove = useCart((s) => s.remove);
  const pending = useCart((s) => s.pending) === item.productId;

  const [draft, setDraft] = useState(String(item.quantity));
  const [synced, setSynced] = useState(item.quantity);

  // The server is authoritative — if it clamped or rejected a change, the input
  // has to follow it back rather than keep showing what was typed. Adjusted
  // during render rather than in an effect so the field never paints a stale
  // number for a frame.
  if (item.quantity !== synced) {
    setSynced(item.quantity);
    setDraft(String(item.quantity));
  }

  const step = item.minimumOrderQuantity || 1;

  async function commit(quantity: number) {
    const next = Math.max(0, Math.min(item.availableStock, quantity));
    if (next === item.quantity) {
      setDraft(String(item.quantity));
      return;
    }
    onError(null);
    try {
      await update(item.productId, next, item.color);
    } catch (err) {
      setDraft(String(item.quantity));
      onError(err instanceof ApiError ? err.message : "Could not update that item.");
    }
  }

  async function drop() {
    onError(null);
    try {
      await remove(item.productId, item.color);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Could not remove that item.");
    }
  }

  return (
    <li className={cn("flex gap-4 p-4", pending && "opacity-60")}>
      <Link
        href={`/products/${item.slug}`}
        className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-raised sm:size-24"
      >
        {item.image && (
          <Image
            src={cdnImage(item.image, { width: 200, height: 200 })}
            alt={item.name}
            fill
            sizes="96px"
            placeholder="blur"
            blurDataURL={cdnBlur(item.image)}
            className="object-cover"
          />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/products/${item.slug}`}
              className="line-clamp-2 text-sm font-medium text-ink hover:text-indigo-600"
            >
              {item.name}
            </Link>
            <p className="mt-0.5 text-xs text-ink-subtle">
              {item.category}
              {item.color && ` · ${item.color}`}
            </p>
          </div>

          <button
            type="button"
            onClick={drop}
            disabled={pending}
            className="shrink-0 rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-raised hover:text-rose-500"
            aria-label={`Remove ${item.name}`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        {item.issues.length > 0 && (
          <ul className="mt-2 space-y-1">
            {item.issues.map((issue) => (
              <li
                key={issue}
                className="flex items-start gap-1.5 text-xs font-medium text-rose-500"
              >
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                {issue}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex h-9 items-center rounded-lg border border-line">
            <button
              type="button"
              onClick={() => commit(item.quantity - step)}
              disabled={pending || item.quantity <= step}
              className="grid size-9 place-items-center text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="size-3.5" />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commit(Number(draft) || item.quantity)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              inputMode="numeric"
              aria-label={`Quantity in ${item.unit}`}
              className="h-full w-14 border-x border-line bg-transparent text-center text-sm font-medium text-ink tnum focus:outline-none"
            />
            <button
              type="button"
              onClick={() => commit(item.quantity + step)}
              disabled={pending || item.quantity >= item.availableStock}
              className="grid size-9 place-items-center text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="size-3.5" />
            </button>
            <span className="px-2.5 text-xs text-ink-subtle">{item.unit}</span>
          </div>

          <div className="text-right">
            <p className="text-sm font-semibold text-ink tnum">
              {formatPrice(item.lineTotal)}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-subtle tnum">
              {formatPrice(item.unitPrice)}/{item.unit}
              {item.priceChangedFrom !== undefined &&
                item.priceChangedFrom > item.unitPrice && (
                  <span className="ml-1 line-through opacity-70">
                    {formatPrice(item.priceChangedFrom)}
                  </span>
                )}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}

function OrderSummary() {
  const cart = useCart((s) => s.cart);

  return (
    <aside className="lg:sticky lg:top-24">
      <div className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Order summary</h2>

        <dl className="mt-4 space-y-2.5 text-sm">
          <Row label={`Subtotal (${cart.lineCount} items)`}>
            {formatPrice(cart.subtotal)}
          </Row>
          <Row label="GST (5%)">{formatPrice(cart.taxAmount)}</Row>
          <Row label="Shipping">
            {cart.shippingFee > 0 ? (
              formatPrice(cart.shippingFee)
            ) : (
              <span className="text-moss-600">Quoted by supplier</span>
            )}
          </Row>

          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <dt className="text-sm font-medium text-ink">Total</dt>
            <dd className="font-display text-2xl text-ink tnum">
              {formatPrice(cart.total)}
            </dd>
          </div>
        </dl>

        {cart.hasIssues ? (
          <>
            <Button size="lg" className="mt-5 w-full" disabled>
              Resolve issues to continue
            </Button>
            <p className="mt-2 text-center text-xs text-ink-subtle">
              Adjust the highlighted lines above.
            </p>
          </>
        ) : (
          <LinkButton href="/checkout" size="lg" className="mt-5 w-full">
            Proceed to checkout
            <ArrowRight className="size-[18px]" />
          </LinkButton>
        )}

        <div className="mt-4 flex flex-col items-center justify-center gap-1.5 text-center">
          <Badge tone="moss" className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs">
            <ShieldCheck className="size-3.5 text-moss-600" />
            <span>No payment needed</span>
          </Badge>
          <p className="text-[11px] leading-tight text-ink-subtle">
            Suppliers confirm before dispatch
          </p>
        </div>
      </div>

      <Link
        href="/products"
        className="mt-4 block text-center text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
      >
        Continue shopping
      </Link>
    </aside>
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

function CartSkeleton() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-card border border-line bg-surface p-4">
            <Skeleton className="h-4 w-40" />
            <div className="mt-4 flex gap-4">
              <Skeleton className="size-24 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="mt-4 h-9 w-36" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-64 rounded-card" />
    </div>
  );
}

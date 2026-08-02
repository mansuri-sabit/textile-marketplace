"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingBag, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { cn, formatPrice } from "@/lib/cn";
import { useCart } from "@/store/cart";
import { useSession } from "@/store/session";
import type { ProductDetail } from "@/types";

export function AddToCart({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const add = useCart((s) => s.add);
  const pending = useCart((s) => s.pending) === product._id;

  const moq = product.minimumOrderQuantity ?? 1;
  const [quantity, setQuantity] = useState(moq);
  const [color, setColor] = useState(product.colors?.[0]?.name);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const soldOut = product.status === "out_of_stock" || product.stock === 0;

  // Mirrors the server's tier logic so the buyer sees the real unit price
  // before committing, not a base price that changes at checkout.
  const unitPrice = useMemo(() => {
    const qualifying = (product.bulkTiers ?? [])
      .filter((t) => quantity >= t.minQuantity)
      .map((t) => t.pricePerUnit);
    return qualifying.length
      ? Math.min(product.pricePerUnit, ...qualifying)
      : product.pricePerUnit;
  }, [product.bulkTiers, product.pricePerUnit, quantity]);

  const savings = (product.pricePerUnit - unitPrice) * quantity;
  const nextTier = (product.bulkTiers ?? [])
    .filter((t) => quantity < t.minQuantity)
    .sort((a, b) => a.minQuantity - b.minQuantity)[0];

  async function submit() {
    setError(null);

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/products/${product.slug}`)}`);
      return;
    }
    if (user.role !== "buyer") {
      setError("Supplier accounts cannot place orders. Sign in as a buyer to purchase.");
      return;
    }

    try {
      await add(product._id, quantity, color);
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not add this to your cart.",
      );
    }
  }

  const clamp = (value: number) => Math.max(moq, Math.min(product.stock, value));

  return (
    <div className="space-y-5">
      {product.colors?.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">
            Colour
            <span className="ml-2 font-normal text-ink-muted">{color}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setColor(c.name)}
                title={c.name}
                aria-label={c.name}
                aria-pressed={color === c.name}
                className={cn(
                  "relative size-9 rounded-full border-2 transition-transform hover:scale-105",
                  color === c.name
                    ? "border-indigo-500 ring-2 ring-indigo-500/20"
                    : "border-line",
                )}
                style={{ backgroundColor: c.hex }}
              >
                {color === c.name && (
                  <Check className="absolute inset-0 m-auto size-4 text-white mix-blend-difference" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-medium text-ink">Quantity</p>
          <p className="text-xs text-ink-subtle tnum">
            MOQ {moq} {product.unit} · {product.stock} available
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-11 items-center rounded-lg border border-line bg-surface">
            <button
              type="button"
              onClick={() => setQuantity((q) => clamp(q - moq))}
              disabled={quantity <= moq}
              className="grid size-11 place-items-center text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="size-4" />
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || moq)}
              onBlur={() => setQuantity((q) => clamp(q))}
              aria-label="Quantity"
              className="h-full w-16 border-x border-line bg-transparent text-center text-sm font-medium text-ink tnum focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => clamp(q + moq))}
              disabled={quantity >= product.stock}
              className="grid size-11 place-items-center text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <span className="text-sm text-ink-muted">{product.unit}</span>
        </div>
      </div>

      <div className="rounded-card border border-line bg-raised p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-muted">
            {quantity} {product.unit} × {formatPrice(unitPrice)}
          </span>
          <span className="font-display text-2xl text-ink tnum">
            {formatPrice(unitPrice * quantity)}
          </span>
        </div>

        {savings > 0 && (
          <p className="mt-1.5 text-xs font-medium text-moss-600 tnum">
            Bulk price applied — you save {formatPrice(savings)}
          </p>
        )}

        {nextTier && (
          <p className="mt-1.5 text-xs text-ink-subtle tnum">
            Order {nextTier.minQuantity} {product.unit} or more for{" "}
            {formatPrice(nextTier.pricePerUnit)}/{product.unit}
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-500"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button
          size="lg"
          className="flex-1"
          onClick={submit}
          loading={pending}
          disabled={soldOut || status === "loading"}
        >
          {added ? (
            <>
              <Check className="size-[18px]" />
              Added to cart
            </>
          ) : (
            <>
              <ShoppingBag className="size-[18px]" />
              {soldOut ? "Out of stock" : "Add to cart"}
            </>
          )}
        </Button>

        {added && (
          <Button size="lg" variant="secondary" onClick={() => router.push("/cart")}>
            View cart
          </Button>
        )}
      </div>

      {!user && status === "ready" && (
        <p className="text-center text-xs text-ink-subtle">
          You&rsquo;ll be asked to sign in before adding to your cart.
        </p>
      )}
    </div>
  );
}

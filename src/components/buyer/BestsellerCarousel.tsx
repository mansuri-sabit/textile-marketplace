"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatPrice } from "@/lib/cn";
import { cdnImage } from "@/lib/image";

export type Bestseller = {
  _id: string;
  name: string;
  slug: string;
  image: string;
  unit: string;
  /** List price, before any volume tier. */
  pricePerUnit: number;
  /** Cheapest bulk tier, or the list price when the fabric has no tiers. */
  bestPricePerUnit: number;
  /** Quantity that unlocks `bestPricePerUnit`. Zero when there is no tier. */
  bestPriceQuantity: number;
  /** Rounded saving against the list price. Zero when there is no tier. */
  discountPercent: number;
};

/**
 * Bestsellers as a horizontal filmstrip.
 *
 * The struck-through figure is the listing's own price against its cheapest
 * volume tier — not an invented MRP. This is a B2B catalog with no retail price
 * to discount from, and a fabric priced flat simply shows one number, so the
 * strip never implies a saving that checkout would not honour.
 *
 * The caption panels stay dark in both themes on purpose: they sit directly
 * under photography, the same reason the category tiles use a fixed black scrim
 * rather than a theme token.
 */
export function BestsellerCarousel({ products }: { products: Bestseller[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Edge state is derived in the scroll handler rather than an effect, so
  // mounting the strip cannot trigger a render loop.
  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    setAtStart(el.scrollLeft <= 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }

  function page(direction: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    // Just under a full viewport, so the tile at the edge stays half in frame
    // and the strip reads as continuous rather than paginated.
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  if (!products.length) return null;

  return (
    <div className="relative">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-card border border-line"
      >
        {products.map((product) => (
          <Link
            key={product._id}
            href={`/products/${product.slug}`}
            className="group w-[64%] shrink-0 snap-start sm:w-[38%] lg:w-1/5"
          >
            <div className="relative aspect-square overflow-hidden bg-raised">
              <Image
                src={cdnImage(product.image, { width: 480, height: 480 })}
                alt=""
                fill
                sizes="(max-width: 640px) 64vw, (max-width: 1024px) 38vw, 20vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            <div className="bg-[#141210] px-3.5 py-3">
              <p className="line-clamp-1 text-sm font-semibold text-white">
                {product.name}
              </p>

              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-sm tnum">
                {product.discountPercent > 0 && (
                  <span className="text-white/40 line-through">
                    {formatPrice(product.pricePerUnit)}
                  </span>
                )}
                <span className="font-semibold text-white">
                  {formatPrice(product.bestPricePerUnit)}
                </span>
              </p>

              {product.discountPercent > 0 ? (
                <p className="mt-1 text-xs font-semibold text-[#7cae83] tnum">
                  {product.discountPercent}% OFF
                  <span className="font-normal text-white/45">
                    {" "}
                    from {product.bestPriceQuantity} {product.unit}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-white/45">per {product.unit}</p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Touch scrolls; the arrows exist for pointers, which have nothing to
          swipe. Both stay mounted so the strip does not shift when one ends. */}
      <PageButton side="left" disabled={atStart} onClick={() => page(-1)} />
      <PageButton side="right" disabled={atEnd} onClick={() => page(1)} />
    </div>
  );
}

function PageButton({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous fabrics" : "Next fabrics"}
      className={cn(
        "absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-surface text-ink shadow-raised transition-opacity hover:bg-raised sm:grid",
        side === "left" ? "left-3" : "right-3",
        disabled && "pointer-events-none opacity-0",
      )}
    >
      {side === "left" ? (
        <ChevronLeft className="size-5" />
      ) : (
        <ChevronRight className="size-5" />
      )}
    </button>
  );
}

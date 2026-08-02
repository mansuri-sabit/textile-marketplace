import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn, formatPrice } from "@/lib/cn";
import { cdnBlur, cdnImage } from "@/lib/image";
import type { ProductCard as Product } from "@/types";

export function ProductCard({
  product,
  priority,
  className,
}: {
  product: Product;
  /** Set on the first row so the largest visible image is not lazy-loaded. */
  priority?: boolean;
  className?: string;
}) {
  const image = product.images?.[0];
  const soldOut = product.status === "out_of_stock" || product.stock === 0;
  const lowStock = !soldOut && product.stock <= 50;

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-all hover:border-line-strong hover:shadow-raised",
        className,
      )}
    >
      <div className="relative aspect-4/3 overflow-hidden bg-raised">
        {image ? (
          <Image
            src={cdnImage(image, { width: 640, height: 480 })}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            placeholder="blur"
            blurDataURL={cdnBlur(image)}
            priority={priority}
            className={cn(
              "object-cover transition-transform duration-500 group-hover:scale-[1.04]",
              soldOut && "opacity-55 saturate-50",
            )}
          />
        ) : (
          <div className="size-full bg-raised" />
        )}

        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {product.featured && <Badge tone="indigo">Featured</Badge>}
          {soldOut && <Badge tone="rose">Out of stock</Badge>}
          {lowStock && <Badge tone="amber">Only {product.stock} left</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
          {product.category}
        </p>

        <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-ink group-hover:text-indigo-600">
          {product.name}
        </h3>

        <p className="mt-1 line-clamp-1 text-xs text-ink-subtle">
          {product.supplier?.businessName}
          {product.supplier?.address?.city && ` · ${product.supplier.address.city}`}
        </p>

        {(product.specifications?.gsm || product.specifications?.composition) && (
          <p className="mt-2 line-clamp-1 text-xs text-ink-muted">
            {product.specifications.gsm && `${product.specifications.gsm} GSM`}
            {product.specifications.gsm && product.specifications.composition && " · "}
            {product.specifications.composition}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            <p className="text-base font-semibold text-ink tnum">
              {formatPrice(product.pricePerUnit)}
              <span className="ml-0.5 text-xs font-normal text-ink-subtle">
                /{product.unit}
              </span>
            </p>
            <p className="mt-0.5 text-[11px] text-ink-subtle tnum">
              MOQ {product.minimumOrderQuantity} {product.unit}
            </p>
          </div>

          {Boolean(product.rating) && (
            <span className="flex items-center gap-0.5 text-xs text-ink-muted tnum">
              <Star className="size-3.5 fill-amber-500 text-amber-500" />
              {product.rating?.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="skeleton aspect-4/3" />
      <div className="space-y-2 p-3.5">
        <div className="skeleton h-2.5 w-16 rounded" />
        <div className="skeleton h-3.5 w-full rounded" />
        <div className="skeleton h-3.5 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton mt-4 h-5 w-24 rounded" />
      </div>
    </div>
  );
}

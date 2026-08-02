"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, TriangleAlert, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { cn, formatPrice } from "@/lib/cn";
import { cdnImage } from "@/lib/image";

export type InventoryProduct = {
  _id: string;
  name: string;
  slug: string;
  category: string;
  images: string[];
  pricePerUnit: number;
  unit: string;
  stock: number;
  status: "draft" | "active" | "out_of_stock";
  minimumOrderQuantity: number;
  orderCount?: number;
};

/**
 * A row in the inventory table, with the two edits a supplier makes constantly
 * — stock level and availability — inline rather than behind the full edit
 * form. Anything structural still goes through the form.
 *
 * Stock and status are deliberately not independent: the API forces status to
 * `out_of_stock` at zero and back to `active` above it, so the toggle is hidden
 * when stock is zero rather than offering a state the server would overwrite.
 */
export function InventoryRow({ product }: { product: InventoryProduct }) {
  const router = useRouter();
  const [editingStock, setEditingStock] = useState(false);
  const [draft, setDraft] = useState(String(product.stock));
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveStock() {
    const stock = Number(draft);
    if (!Number.isInteger(stock) || stock < 0) {
      setError("Stock must be a whole number.");
      return;
    }
    if (stock === product.stock) {
      setEditingStock(false);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/supplier/products/${product._id}/stock`, { stock });
      setEditingStock(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update stock.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "active" | "draft") {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/supplier/products/${product._id}`, { status });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this listing.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/supplier/products/${product._id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this listing.");
      setBusy(false);
    }
  }

  const soldOut = product.stock === 0;
  const lowStock = !soldOut && product.stock <= 50;

  return (
    <li className={cn("p-4", busy && "opacity-60")}>
      <div className="flex items-start gap-4">
        <Link
          href={`/products/${product.slug}`}
          className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-raised"
        >
          {product.images?.[0] && (
            <Image
              src={cdnImage(product.images[0], { width: 160, height: 160 })}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/supplier/products/${product._id}/edit`}
              className="text-sm font-medium text-ink hover:text-indigo-600"
            >
              {product.name}
            </Link>
            {product.status === "draft" && <Badge>Draft</Badge>}
            {soldOut && <Badge tone="rose">Out of stock</Badge>}
            {lowStock && <Badge tone="amber">Low</Badge>}
          </div>

          <p className="mt-1 text-xs text-ink-subtle tnum">
            {product.category} · {formatPrice(product.pricePerUnit)}/{product.unit}
            {" · MOQ "}
            {product.minimumOrderQuantity}
            {product.orderCount ? ` · ${product.orderCount} orders` : ""}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {editingStock ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveStock();
                    if (e.key === "Escape") {
                      setDraft(String(product.stock));
                      setEditingStock(false);
                    }
                  }}
                  inputMode="numeric"
                  autoFocus
                  aria-label={`Stock for ${product.name}`}
                  className="h-8 w-20 rounded-lg border border-line bg-surface px-2 text-sm text-ink tnum focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <Button size="sm" onClick={saveStock} loading={busy} aria-label="Save stock">
                  <Check className="size-3.5" />
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(String(product.stock));
                    setEditingStock(false);
                    setError(null);
                  }}
                  className="grid size-8 place-items-center rounded-lg text-ink-subtle hover:bg-raised hover:text-ink"
                  aria-label="Cancel"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingStock(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink tnum"
              >
                <Pencil className="size-3" />
                {product.stock} {product.unit} in stock
              </button>
            )}

            {!soldOut && (
              <button
                type="button"
                onClick={() => setStatus(product.status === "active" ? "draft" : "active")}
                disabled={busy}
                className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
              >
                {product.status === "active" ? "Unlist" : "Publish"}
              </button>
            )}

            <Link
              href={`/supplier/products/${product._id}/edit`}
              className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              Edit
            </Link>

            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="grid size-8 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-raised hover:text-rose-500 disabled:opacity-50"
              aria-label={`Delete ${product.name}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs font-medium text-rose-500"
        >
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {confirmingDelete && (
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-50 p-3.5">
          <p className="text-sm font-medium text-rose-500">
            Delete &ldquo;{product.name}&rdquo;?
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            It disappears from the catalog immediately. Orders already placed
            keep their own copy of the details and are unaffected.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" size="sm" onClick={remove} loading={busy}>
              Delete it
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
            >
              Keep it
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn, formatPrice } from "@/lib/cn";
import type { Facets } from "@/types";

/**
 * Filters live in the URL rather than component state, so a filtered view is
 * shareable, survives a refresh, and the back button steps through it.
 */
export function FilterPanel({ facets, total }: { facets: Facets; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);

  const selected = useCallback(
    (key: string) => params.get(key)?.split(",").filter(Boolean) ?? [],
    [params],
  );

  const apply = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      // Any filter change invalidates the current page number.
      next.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  const toggleMulti = (key: string, value: string) =>
    apply((next) => {
      const current = new Set(next.get(key)?.split(",").filter(Boolean) ?? []);
      if (current.has(value)) current.delete(value);
      else current.add(value);
      if (current.size) next.set(key, [...current].join(","));
      else next.delete(key);
    });

  const setSingle = (key: string, value: string | null) =>
    apply((next) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });

  const activeCount =
    selected("category").length +
    selected("fabricType").length +
    (params.get("certification") ? 1 : 0) +
    (params.get("minPrice") || params.get("maxPrice") ? 1 : 0) +
    (params.get("minGsm") || params.get("maxGsm") ? 1 : 0) +
    (params.get("inStockOnly") === "true" ? 1 : 0);

  const clearAll = () =>
    apply((next) => {
      for (const key of [
        "category",
        "fabricType",
        "certification",
        "minPrice",
        "maxPrice",
        "minGsm",
        "maxGsm",
        "inStockOnly",
        "supplier",
      ]) {
        next.delete(key);
      }
    });

  const body = (
    <div className={cn("space-y-6", pending && "opacity-60 transition-opacity")}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">
          Filters
          {activeCount > 0 && (
            <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 tnum">
              {activeCount}
            </span>
          )}
        </p>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            <RotateCcw className="size-3" />
            Clear
          </button>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface p-3">
        <input
          type="checkbox"
          checked={params.get("inStockOnly") === "true"}
          onChange={(e) => setSingle("inStockOnly", e.target.checked ? "true" : null)}
          className="size-4 rounded border-line-strong accent-indigo-600"
        />
        <span className="text-sm text-ink">In stock only</span>
      </label>

      <FilterGroup title="Category">
        {facets.categories.map((f) => (
          <CheckRow
            key={f.value}
            label={f.value}
            count={f.count}
            checked={selected("category").includes(f.value)}
            onChange={() => toggleMulti("category", f.value)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Construction">
        {facets.fabricTypes.map((f) => (
          <CheckRow
            key={f.value}
            label={f.value}
            count={f.count}
            checked={selected("fabricType").includes(f.value)}
            onChange={() => toggleMulti("fabricType", f.value)}
          />
        ))}
      </FilterGroup>

      <RangeGroup
        title="Price per unit"
        unit="₹"
        bounds={facets.price}
        minKey="minPrice"
        maxKey="maxPrice"
        params={params}
        onApply={apply}
        format={formatPrice}
      />

      <RangeGroup
        title="Weight (GSM)"
        unit="GSM"
        bounds={facets.gsm}
        minKey="minGsm"
        maxKey="maxGsm"
        params={params}
        onApply={apply}
        format={(v) => `${v} GSM`}
      />

      {facets.certifications.length > 0 && (
        <FilterGroup title="Certification">
          {facets.certifications.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() =>
                setSingle(
                  "certification",
                  params.get("certification") === f.value ? null : f.value,
                )
              }
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                params.get("certification") === f.value
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-ink-muted hover:bg-raised hover:text-ink",
              )}
            >
              <span className="flex items-center gap-2">
                {params.get("certification") === f.value && <Check className="size-3.5" />}
                {f.value}
              </span>
              <span className="text-xs text-ink-subtle tnum">{f.count}</span>
            </button>
          ))}
        </FilterGroup>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden"
      >
        <SlidersHorizontal className="size-4" />
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-indigo-600 px-1.5 text-[11px] text-white tnum">
            {activeCount}
          </span>
        )}
      </Button>

      <aside className="hidden lg:block">{body}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-60 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-paper shadow-raised">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Filters</p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-lg text-ink-muted"
                aria-label="Close filters"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{body}</div>
            <div className="border-t border-line p-4">
              <Button className="w-full" onClick={() => setMobileOpen(false)}>
                Show {total} results
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function CheckRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-raised">
      <span className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="size-4 rounded border-line-strong accent-indigo-600"
        />
        <span className={cn("text-sm", checked ? "text-ink" : "text-ink-muted")}>
          {label}
        </span>
      </span>
      <span className="text-xs text-ink-subtle tnum">{count}</span>
    </label>
  );
}

function RangeGroup({
  title,
  bounds,
  minKey,
  maxKey,
  params,
  onApply,
  format,
}: {
  title: string;
  unit: string;
  bounds: { min: number; max: number };
  minKey: string;
  maxKey: string;
  params: URLSearchParams;
  onApply: (mutate: (next: URLSearchParams) => void) => void;
  format: (value: number) => string;
}) {
  const [min, setMin] = useState(params.get(minKey) ?? "");
  const [max, setMax] = useState(params.get(maxKey) ?? "");

  function commit() {
    onApply((next) => {
      if (min) next.set(minKey, min);
      else next.delete(minKey);
      if (max) next.set(maxKey, max);
      else next.delete(maxKey);
    });
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {title}
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          placeholder={String(bounds.min)}
          aria-label={`Minimum ${title}`}
          className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm tnum focus:border-indigo-400 focus:outline-none"
        />
        <span className="text-ink-subtle">–</span>
        <input
          type="number"
          inputMode="numeric"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          placeholder={String(bounds.max)}
          aria-label={`Maximum ${title}`}
          className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm tnum focus:border-indigo-400 focus:outline-none"
        />
      </div>
      <p className="mt-1.5 text-[11px] text-ink-subtle">
        Catalog range {format(bounds.min)} – {format(bounds.max)}
      </p>
    </div>
  );
}

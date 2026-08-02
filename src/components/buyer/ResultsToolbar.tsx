"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui";
import type { SearchMode } from "@/types";

const SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "popular", label: "Most ordered" },
];

export function ResultsToolbar({
  total,
  mode,
  query,
}: {
  total: number;
  mode: SearchMode;
  query?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setSort(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("sort", value);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function clearQuery() {
    const next = new URLSearchParams(params.toString());
    next.delete("q");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-ink-muted">
          <span className="font-medium text-ink tnum">{total}</span>{" "}
          {total === 1 ? "fabric" : "fabrics"}
        </p>

        {query && (
          <button
            type="button"
            onClick={clearQuery}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-2.5 pr-2 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            &ldquo;{query}&rdquo;
            <X className="size-3" />
          </button>
        )}

        {/* Say which engine answered rather than implying the two are the same. */}
        {mode === "semantic" && (
          <Badge tone="indigo">
            <Sparkles className="size-3" />
            AI matched
          </Badge>
        )}
        {mode === "keyword" && query && <Badge tone="neutral">Keyword match</Badge>}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-ink-subtle">Sort</span>
        <select
          value={params.get("sort") ?? "relevance"}
          onChange={(e) => setSort(e.target.value)}
          className="h-9 rounded-lg border border-line bg-surface pl-2.5 pr-8 text-sm text-ink focus:border-indigo-400 focus:outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function Pagination({
  page,
  pages,
  className,
}: {
  page: number;
  pages: number;
  className?: string;
}) {
  const params = useSearchParams();
  const pathname = usePathname();

  if (pages <= 1) return null;

  function href(target: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(target));
    return `${pathname}?${next.toString()}`;
  }

  // Compact window around the current page so long catalogs do not produce a
  // hundred page links.
  const window: number[] = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(pages, from + 4);
  for (let i = Math.max(1, to - 4); i <= to; i++) window.push(i);

  return (
    <nav className={className} aria-label="Pagination">
      <ul className="flex items-center justify-center gap-1.5">
        <li>
          <PageLink href={href(page - 1)} disabled={page === 1}>
            Previous
          </PageLink>
        </li>
        {window[0] > 1 && (
          <>
            <li>
              <PageLink href={href(1)}>1</PageLink>
            </li>
            {window[0] > 2 && <li className="px-1 text-ink-subtle">…</li>}
          </>
        )}
        {window.map((p) => (
          <li key={p}>
            <PageLink href={href(p)} current={p === page}>
              {p}
            </PageLink>
          </li>
        ))}
        {window[window.length - 1] < pages && (
          <>
            {window[window.length - 1] < pages - 1 && (
              <li className="px-1 text-ink-subtle">…</li>
            )}
            <li>
              <PageLink href={href(pages)}>{pages}</PageLink>
            </li>
          </>
        )}
        <li>
          <PageLink href={href(page + 1)} disabled={page === pages}>
            Next
          </PageLink>
        </li>
      </ul>
    </nav>
  );
}

function PageLink({
  href,
  current,
  disabled,
  children,
}: {
  href: string;
  current?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const classes =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm transition-colors tnum";

  if (disabled) {
    return (
      <span className={`${classes} cursor-not-allowed text-ink-subtle opacity-50`}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      scroll
      aria-current={current ? "page" : undefined}
      className={`${classes} ${
        current
          ? "bg-indigo-600 text-white dark:bg-indigo-500 dark:text-indigo-50"
          : "border border-line text-ink-muted hover:bg-raised hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

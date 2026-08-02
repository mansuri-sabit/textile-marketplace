"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";

const EXAMPLES = [
  "breathable cotton for summer shirting",
  "heavy denim for workwear jackets",
  "something for a wedding lehenga with gold work",
  "GOTS certified organic knit, 180 GSM",
];

/**
 * The hero search is deliberately phrased as a description rather than a
 * keyword box — the catalog is embedded, so a sentence works better here than
 * a product name, and the example chips teach that in one glance.
 */
export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function go(value: string) {
    const q = value.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }

  return (
    <div className="w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(query);
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe the fabric you need…"
          aria-label="Describe the fabric you need"
          className="h-14 w-full rounded-2xl border border-line bg-surface pl-12 pr-32 text-[15px] text-ink shadow-card placeholder:text-ink-subtle focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/12"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 inline-flex h-10 -translate-y-1/2 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:text-indigo-50"
        >
          <Sparkles className="size-4" />
          Search
        </button>
      </form>

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-ink-subtle">Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setQuery(example);
              go(example);
            }}
            className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-indigo-200 hover:text-indigo-600"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

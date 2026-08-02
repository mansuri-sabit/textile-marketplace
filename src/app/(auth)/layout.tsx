import Link from "next/link";

/**
 * Auth pages get a focused split layout instead of the marketplace chrome —
 * the goal on these two screens is one action, not browsing.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-line bg-indigo-50 lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 9px), repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 9px)",
            color: "var(--color-indigo-900)",
          }}
        />
        <blockquote className="relative max-w-md">
          <p className="font-display text-3xl leading-snug text-indigo-900">
            &ldquo;We stopped emailing swatch requests to eleven mills. Now we filter by
            GSM and place the order the same afternoon.&rdquo;
          </p>
          <footer className="mt-6 text-sm text-indigo-600">
            Sourcing lead, womenswear label
            <span className="mt-1 block text-xs text-indigo-400">
              Illustrative — this is a prototype
            </span>
          </footer>
        </blockquote>

        <dl className="relative mt-14 grid grid-cols-3 gap-6 border-t border-indigo-200 pt-8">
          {[
            { value: "105", label: "Fabrics listed" },
            { value: "10", label: "Verified mills" },
            { value: "12", label: "Categories" },
          ].map((s) => (
            <div key={s.label}>
              <dd className="font-display text-2xl text-indigo-900 tnum">{s.value}</dd>
              <dt className="mt-0.5 text-xs text-indigo-600">{s.label}</dt>
            </div>
          ))}
        </dl>

        <p className="relative mt-14 text-xs text-indigo-400">
          <Link href="/products" className="underline underline-offset-2">
            Browse without an account
          </Link>
        </p>
      </aside>
    </div>
  );
}

import Link from "next/link";

const COLUMNS = [
  {
    title: "Browse",
    links: [
      { href: "/products", label: "All fabrics" },
      { href: "/products?category=Cotton", label: "Cotton" },
      { href: "/products?category=Silk", label: "Silk" },
      { href: "/products?category=Knits+%26+Jersey", label: "Knits & jersey" },
      { href: "/suppliers", label: "Suppliers" },
    ],
  },
  {
    title: "For buyers",
    links: [
      { href: "/register?role=buyer", label: "Create an account" },
      { href: "/products?sort=popular", label: "Popular fabrics" },
      { href: "/products?certification=GOTS", label: "GOTS certified" },
      { href: "/orders", label: "Track an order" },
    ],
  },
  {
    title: "For suppliers",
    links: [
      { href: "/register?role=supplier", label: "List your business" },
      { href: "/supplier", label: "Supplier dashboard" },
      { href: "/supplier/products", label: "Manage inventory" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white">
                <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
                  <path
                    d="M3 7h18M3 12h18M3 17h18M7 3v18M12 3v18M17 3v18"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    opacity="0.9"
                  />
                </svg>
              </span>
              <span className="font-display text-lg text-ink">
                Textile<span className="text-indigo-500">Mart</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
              A B2B fabric marketplace connecting mills, handloom collectives and
              converters with the brands that buy from them.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>Built as a hackathon prototype. No real transactions are processed.</p>
          <p>
            Catalog photography from{" "}
            <a
              href="https://www.pexels.com"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 transition-colors hover:text-ink-muted"
            >
              Pexels
            </a>
            , credited on each product page.
          </p>
        </div>
      </div>
    </footer>
  );
}

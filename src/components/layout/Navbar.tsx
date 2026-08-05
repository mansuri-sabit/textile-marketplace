"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  Store,
  User,
  X,
} from "lucide-react";
import { useCart } from "@/store/cart";
import { useSession } from "@/store/session";
import { ThemeToggle } from "./ThemeToggle";

const BROWSE_LINKS = [
  { href: "/products", label: "All fabrics" },
  { href: "/products?category=Cotton", label: "Cotton" },
  { href: "/products?category=Silk", label: "Silk" },
  { href: "/products?category=Linen", label: "Linen" },
  { href: "/suppliers", label: "Suppliers" },
];

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const logout = useSession((s) => s.logout);
  const itemCount = useCart((s) => s.cart.itemCount);

  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Route changes must close both menus, or they linger over the new page.
  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }

  const isSupplier = user?.role === "supplier";

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="-ml-2 inline-flex size-10 items-center justify-center rounded-lg text-ink-muted lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2">
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
          {/*
            The supplied wordmark is dark ink and indigo on transparency, which
            disappears against the dark theme — `brightness-0 invert` flattens it
            to white there rather than shipping a second file. `alt` carries the
            brand name, so the header still reads as TextileMart to a screen
            reader and when images fail.
          */}
          <Image
            src="/logo.png"
            alt="TextileMart"
            width={739}
            height={128}
            priority
            className="h-[22px] w-auto dark:brightness-0 dark:invert"
          />
        </Link>

        {!isSupplier && (
          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {BROWSE_LINKS.slice(0, 4).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {/*
         * No supplier nav here on desktop: the console's own tab bar carries the
         * same links one row below, with an active state this row cannot show.
         * The mobile menu below still lists them, since that tab bar is the only
         * navigation once the header collapses.
         */}

        {!isSupplier && (
          <form onSubmit={submitSearch} className="ml-auto hidden max-w-md flex-1 md:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Describe the fabric you need…"
                aria-label="Search fabrics"
                className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </form>
        )}

        {/* `ml-auto` unconditionally: the search form only claims the middle of
            the row from `md` up, so without it these actions sat against the
            logo on phones instead of the right edge. */}
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle className="hidden sm:inline-flex" />

          {!isSupplier && (
            <Link
              href="/cart"
              className="relative inline-flex size-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink"
              aria-label={`Cart, ${itemCount} items`}
            >
              <ShoppingBag className="size-[18px]" />
              {itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-clay-500 px-1 text-[10px] font-semibold leading-[18px] text-white tnum">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>
          )}

          {status === "loading" && <div className="size-9 rounded-lg skeleton" />}

          {status === "ready" && !user && (
            <div className="flex items-center gap-2 pl-1">
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="hidden rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 sm:inline-flex dark:bg-indigo-500 dark:text-indigo-50"
              >
                Get started
              </Link>
            </div>
          )}

          {status === "ready" && user && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="ml-1 inline-flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 text-sm transition-colors hover:bg-raised"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="grid size-7 place-items-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-600">
                  {user.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden max-w-24 truncate text-ink-muted sm:inline">
                  {user.name.split(" ")[0]}
                </span>
                <ChevronDown className="size-3.5 text-ink-subtle" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-raised"
                >
                  <div className="border-b border-line px-3.5 py-3">
                    <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                    <p className="truncate text-xs text-ink-subtle">{user.email}</p>
                  </div>
                  <div className="p-1.5">
                    {isSupplier ? (
                      <>
                        <MenuLink href="/supplier" icon={<LayoutDashboard className="size-4" />} onClick={() => setMenuOpen(false)}>
                          Dashboard
                        </MenuLink>
                        <MenuLink href="/supplier/products" icon={<Package className="size-4" />} onClick={() => setMenuOpen(false)}>
                          Inventory
                        </MenuLink>
                        <MenuLink href="/supplier/profile" icon={<Store className="size-4" />} onClick={() => setMenuOpen(false)}>
                          Business profile
                        </MenuLink>
                      </>
                    ) : (
                      <>
                        <MenuLink href="/buyer" icon={<LayoutDashboard className="size-4" />} onClick={() => setMenuOpen(false)}>
                          Dashboard
                        </MenuLink>
                        <MenuLink href="/orders" icon={<Package className="size-4" />} onClick={() => setMenuOpen(false)}>
                          My orders
                        </MenuLink>
                        <MenuLink href="/buyer/profile" icon={<User className="size-4" />} onClick={() => setMenuOpen(false)}>
                          Profile
                        </MenuLink>
                      </>
                    )}
                  </div>
                  <div className="border-t border-line p-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        router.push("/");
                        router.refresh();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-surface lg:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
            {!isSupplier && (
              <form onSubmit={submitSearch} className="pb-2 md:hidden">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Describe the fabric you need…"
                    aria-label="Search fabrics"
                    className="h-10 w-full rounded-full border border-line bg-paper pl-9 pr-3 text-sm"
                  />
                </div>
              </form>
            )}

            {(isSupplier
              ? [
                  { href: "/supplier", label: "Dashboard" },
                  { href: "/supplier/products", label: "Inventory" },
                  { href: "/supplier/orders", label: "Orders" },
                  { href: "/supplier/profile", label: "Business profile" },
                ]
              : BROWSE_LINKS
            ).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-lg px-3 py-2.5 text-sm text-ink-muted hover:bg-raised hover:text-ink"
              >
                {link.label}
              </Link>
            ))}

            <div className="flex items-center justify-between border-t border-line pt-3">
              <span className="text-sm text-ink-muted">Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function MenuLink({
  href,
  icon,
  onClick,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink"
    >
      {icon}
      {children}
    </Link>
  );
}

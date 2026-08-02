"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Receipt, Store } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/supplier", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/supplier/products", label: "Inventory", icon: Package },
  { href: "/supplier/orders", label: "Orders", icon: Receipt },
  { href: "/supplier/profile", label: "Business profile", icon: Store },
];

/**
 * Console sub-navigation. The header already carries these links, but a
 * supplier working through orders needs to see where they are without reading
 * the URL — and on mobile the header nav collapses behind a menu button.
 */
export function ConsoleNav() {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar -mx-4 mb-8 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3 text-sm transition-colors",
              active
                ? "border-indigo-500 font-medium text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

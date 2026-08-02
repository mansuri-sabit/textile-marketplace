"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Applied before paint by the inline script in the root layout, so this
 * component only ever reads back what is already on <html> — it never causes
 * the flash of wrong theme that a mount-time effect would.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private browsing can block storage; the toggle still works this session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink",
        className,
      )}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {/* Render nothing until mounted so server and client markup agree. */}
      {mounted && (dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />)}
    </button>
  );
}

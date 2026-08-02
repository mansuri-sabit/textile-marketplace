"use client";

import { useEffect } from "react";
import { useCart } from "@/store/cart";
import { useSession } from "@/store/session";

/**
 * Hydrates client stores once per page load. Mounted in the root layout so
 * every route has the session available without each page re-fetching it.
 */
export function SessionBootstrap() {
  const load = useSession((s) => s.load);
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const loadCart = useCart((s) => s.load);
  const resetCart = useCart((s) => s.reset);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    // Only buyers have a cart; fetching it as a supplier would 403 on every load.
    if (user?.role === "buyer") void loadCart();
    else resetCart();
  }, [user?.role, loadCart, resetCart]);

  return null;
}

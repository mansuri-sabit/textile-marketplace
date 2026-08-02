import type { Metadata } from "next";
import { CartView } from "@/components/buyer/CartView";

export const metadata: Metadata = {
  title: "Your cart",
  description: "Review quantities, bulk pricing and supplier splits before checkout.",
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Your cart</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Bulk tiers are applied as you change quantities, so the price you see
          here is the price you pay.
        </p>
      </header>

      <CartView />
    </div>
  );
}

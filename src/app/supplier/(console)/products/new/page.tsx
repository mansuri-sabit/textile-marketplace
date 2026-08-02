import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BLANK, ProductForm } from "@/components/supplier/ProductForm";

export const metadata: Metadata = {
  title: "List a fabric",
  description: "Add a new product to your catalog.",
};

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/supplier/products"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Inventory
      </Link>

      <header className="mb-8 mt-4">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">
          List a fabric
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Everything except the specifications is required. The listing goes live
          — and becomes semantically searchable — the moment you publish.
        </p>
      </header>

      <ProductForm initial={BLANK} />
    </div>
  );
}

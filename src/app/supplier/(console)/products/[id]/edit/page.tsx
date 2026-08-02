import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  ProductForm,
  type ProductFormValues,
} from "@/components/supplier/ProductForm";
import { AppError } from "@/server/lib/api";
import { getSession } from "@/server/middleware/session";
import {
  getSupplierProduct,
  requireSupplierProfile,
} from "@/server/services/supplier.service";
import { serialize } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit listing",
  robots: { index: false },
};

/** The stored product, flattened into the string-based shape the form edits. */
type StoredProduct = {
  name: string;
  slug: string;
  description: string;
  category: string;
  fabricType: string;
  images: string[];
  colors?: Array<{ name: string; hex: string }>;
  pricePerUnit: number;
  unit: string;
  bulkTiers?: Array<{ minQuantity: number; pricePerUnit: number }>;
  stock: number;
  minimumOrderQuantity: number;
  status: string;
  tags?: string[];
  specifications?: {
    gsm?: number;
    widthInches?: number;
    composition?: string;
    weave?: string;
    finish?: string;
    shrinkage?: string;
    careInstructions?: string;
    certifications?: string[];
  };
};

function toFormValues(product: StoredProduct): ProductFormValues {
  const spec = product.specifications ?? {};
  const str = (v: number | undefined) => (v === undefined ? "" : String(v));

  return {
    name: product.name,
    description: product.description,
    category: product.category,
    fabricType: product.fabricType,
    images: product.images ?? [],
    colors: (product.colors ?? []).map((c) => ({ name: c.name, hex: c.hex })),
    pricePerUnit: String(product.pricePerUnit),
    unit: product.unit,
    bulkTiers: (product.bulkTiers ?? []).map((t) => ({
      minQuantity: String(t.minQuantity),
      pricePerUnit: String(t.pricePerUnit),
    })),
    stock: String(product.stock),
    minimumOrderQuantity: String(product.minimumOrderQuantity ?? 1),
    // `out_of_stock` is a consequence of stock hitting zero, not something the
    // supplier picks — the form offers live/unlisted only.
    status: product.status === "draft" ? "draft" : "active",
    tags: (product.tags ?? []).join(", "),
    specifications: {
      gsm: str(spec.gsm),
      widthInches: str(spec.widthInches),
      composition: spec.composition ?? "",
      weave: spec.weave ?? "",
      finish: spec.finish ?? "",
      shrinkage: spec.shrinkage ?? "",
      careInstructions: spec.careInstructions ?? "",
      certifications: (spec.certifications ?? []).join(", "),
    },
  };
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/supplier/products/${id}/edit`)}`);
  }

  const profile = await requireSupplierProfile(session.sub);

  let raw;
  try {
    raw = await getSupplierProduct(String(profile._id), id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }

  const product = serialize<StoredProduct>(raw);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/supplier/products"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Inventory
      </Link>

      <header className="mb-8 mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-ink sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Changes are live the moment you save.
          </p>
        </div>
        <Link
          href={`/products/${product.slug}`}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-indigo-600 underline-offset-2 hover:underline"
        >
          View as a buyer
          <ExternalLink className="size-3.5" />
        </Link>
      </header>

      <ProductForm initial={toFormValues(product)} productId={id} />
    </div>
  );
}

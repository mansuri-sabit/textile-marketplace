"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Save, TriangleAlert, X } from "lucide-react";
import { ImageUploader } from "@/components/supplier/ImageUploader";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import {
  FABRIC_TYPES,
  PRICING_UNITS,
  PRODUCT_CATEGORIES,
} from "@/server/constants/marketplace";
import { formatPrice } from "@/lib/cn";

/**
 * Create and edit share one form — the fields are identical and a second copy
 * would drift. `productId` is what switches it from POST to PATCH.
 *
 * Numbers are held as strings while editing so a half-typed "12." does not get
 * coerced to 12 under the supplier's cursor; they are converted once on submit,
 * where the server's zod schema is the real gate.
 */

export type ProductFormValues = {
  name: string;
  description: string;
  category: string;
  fabricType: string;
  images: string[];
  colors: Array<{ name: string; hex: string }>;
  pricePerUnit: string;
  unit: string;
  bulkTiers: Array<{ minQuantity: string; pricePerUnit: string }>;
  stock: string;
  minimumOrderQuantity: string;
  status: string;
  tags: string;
  specifications: {
    gsm: string;
    widthInches: string;
    composition: string;
    weave: string;
    finish: string;
    shrinkage: string;
    careInstructions: string;
    certifications: string;
  };
};

export const BLANK: ProductFormValues = {
  name: "",
  description: "",
  category: "",
  fabricType: "",
  images: [],
  colors: [],
  pricePerUnit: "",
  unit: "metre",
  bulkTiers: [],
  stock: "",
  minimumOrderQuantity: "1",
  status: "active",
  tags: "",
  specifications: {
    gsm: "",
    widthInches: "",
    composition: "",
    weave: "",
    finish: "",
    shrinkage: "",
    careInstructions: "",
    certifications: "",
  },
};

const list = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const num = (value: string) => (value.trim() === "" ? undefined : Number(value));

export function ProductForm({
  initial,
  productId,
}: {
  initial: ProductFormValues;
  /** Present when editing; absent creates a new listing. */
  productId?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set =
    <K extends keyof ProductFormValues>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setErrors((f) => ({ ...f, [key]: "" }));
    };

  const setSpec =
    (key: keyof ProductFormValues["specifications"]) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({
        ...f,
        specifications: { ...f.specifications, [key]: e.target.value },
      }));
    };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFailure(null);
    setErrors({});

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      fabricType: form.fabricType,
      images: form.images,
      colors: form.colors.filter((c) => c.name.trim() && /^#[0-9a-fA-F]{6}$/.test(c.hex)),
      pricePerUnit: num(form.pricePerUnit),
      unit: form.unit,
      bulkTiers: form.bulkTiers
        .filter((t) => t.minQuantity.trim() && t.pricePerUnit.trim())
        .map((t) => ({
          minQuantity: Number(t.minQuantity),
          pricePerUnit: Number(t.pricePerUnit),
        })),
      stock: num(form.stock) ?? 0,
      minimumOrderQuantity: num(form.minimumOrderQuantity) ?? 1,
      status: form.status,
      tags: list(form.tags),
      specifications: {
        gsm: num(form.specifications.gsm),
        widthInches: num(form.specifications.widthInches),
        composition: form.specifications.composition.trim() || undefined,
        weave: form.specifications.weave.trim() || undefined,
        finish: form.specifications.finish.trim() || undefined,
        shrinkage: form.specifications.shrinkage.trim() || undefined,
        careInstructions: form.specifications.careInstructions.trim() || undefined,
        certifications: list(form.specifications.certifications),
      },
    };

    try {
      if (productId) {
        await api.patch(`/api/supplier/products/${productId}`, payload);
      } else {
        await api.post("/api/supplier/products", payload);
      }
      router.push("/supplier/products");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setFailure(err.message);
        setErrors(err.fieldErrors);
      } else {
        setFailure("Could not save this listing. Please try again.");
      }
      setSaving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const price = Number(form.pricePerUnit) || 0;

  return (
    <form onSubmit={submit} className="space-y-6">
      {failure && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-500"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {failure}
        </p>
      )}

      <Section title="The basics">
        <Input
          label="Fabric name"
          required
          value={form.name}
          onChange={set("name")}
          error={errors.name}
          placeholder="Combed Cotton Shirting — 120 GSM"
          className="sm:col-span-2"
        />

        <Select
          label="Category"
          required
          value={form.category}
          onChange={set("category")}
          error={errors.category}
          placeholder="Choose a category"
          options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />

        <Select
          label="Construction"
          required
          value={form.fabricType}
          onChange={set("fabricType")}
          error={errors.fabricType}
          placeholder="Choose a construction"
          options={FABRIC_TYPES.map((f) => ({ value: f, label: f }))}
        />

        <Textarea
          label="Description"
          required
          rows={5}
          value={form.description}
          onChange={set("description")}
          error={errors.description}
          hint="What it is, how it handles, what it is good for. This is also what semantic search matches on, so write it for a buyer, not a spec sheet."
          placeholder="A tightly woven combed cotton with a soft dry handle, finished for minimal shrinkage…"
          className="sm:col-span-2"
        />
      </Section>

      <Section title="Images" description="At least one. The first is the thumbnail buyers see in the grid.">
        <div className="sm:col-span-2">
          <ImageUploader
            images={form.images}
            onChange={(images) => {
              setForm((f) => ({ ...f, images }));
              setErrors((e) => ({ ...e, images: "" }));
            }}
            error={errors.images}
          />
        </div>
      </Section>

      <Section title="Price and stock">
        <Input
          label="Price per unit"
          required
          inputMode="decimal"
          value={form.pricePerUnit}
          onChange={set("pricePerUnit")}
          error={errors.pricePerUnit}
          placeholder="245"
          hint={price > 0 ? `${formatPrice(price)} per ${form.unit}` : "In rupees"}
        />

        <Select
          label="Sold by"
          value={form.unit}
          onChange={set("unit")}
          options={PRICING_UNITS.map((u) => ({ value: u, label: u }))}
        />

        <Input
          label="Stock available"
          required
          inputMode="numeric"
          value={form.stock}
          onChange={set("stock")}
          error={errors.stock}
          placeholder="2000"
          hint="Zero marks the listing out of stock automatically"
        />

        <Input
          label="Minimum order quantity"
          inputMode="numeric"
          value={form.minimumOrderQuantity}
          onChange={set("minimumOrderQuantity")}
          error={errors.minimumOrderQuantity}
          placeholder="100"
        />

        <Select
          label="Availability"
          value={form.status}
          onChange={set("status")}
          options={[
            { value: "active", label: "Live — visible to buyers" },
            { value: "draft", label: "Unlisted — hidden from the catalog" },
          ]}
          hint="Stock of zero overrides this and shows as out of stock"
          className="sm:col-span-2"
        />
      </Section>

      <Section
        title="Bulk pricing"
        description="Optional. A cheaper unit price above a quantity — the cart, checkout and stored order all apply the best tier the buyer qualifies for."
      >
        <div className="space-y-3 sm:col-span-2">
          {form.bulkTiers.map((tier, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3">
              <Input
                label={i === 0 ? "From quantity" : undefined}
                inputMode="numeric"
                value={tier.minQuantity}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    bulkTiers: f.bulkTiers.map((t, n) =>
                      n === i ? { ...t, minQuantity: e.target.value } : t,
                    ),
                  }))
                }
                placeholder="500"
                className="w-32"
              />
              <Input
                label={i === 0 ? "Price per unit" : undefined}
                inputMode="decimal"
                value={tier.pricePerUnit}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    bulkTiers: f.bulkTiers.map((t, n) =>
                      n === i ? { ...t, pricePerUnit: e.target.value } : t,
                    ),
                  }))
                }
                placeholder="225"
                className="w-32"
              />
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    bulkTiers: f.bulkTiers.filter((_, n) => n !== i),
                  }))
                }
                className="grid size-10 place-items-center rounded-lg text-ink-subtle hover:bg-raised hover:text-rose-500"
                aria-label="Remove this tier"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}

          {form.bulkTiers.length < 5 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  bulkTiers: [...f.bulkTiers, { minQuantity: "", pricePerUnit: "" }],
                }))
              }
            >
              <Plus className="size-3.5" />
              Add a tier
            </Button>
          )}
        </div>
      </Section>

      <Section title="Colours" description="Optional. Buyers pick one when adding to their cart.">
        <div className="space-y-3 sm:col-span-2">
          {form.colors.map((color, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3">
              <Input
                label={i === 0 ? "Colour name" : undefined}
                value={color.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    colors: f.colors.map((c, n) =>
                      n === i ? { ...c, name: e.target.value } : c,
                    ),
                  }))
                }
                placeholder="Indigo"
                className="w-44"
              />
              <label className="space-y-1.5">
                {i === 0 && (
                  <span className="block text-sm font-medium text-ink">Swatch</span>
                )}
                <input
                  type="color"
                  value={color.hex}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      colors: f.colors.map((c, n) =>
                        n === i ? { ...c, hex: e.target.value } : c,
                      ),
                    }))
                  }
                  aria-label={`Swatch for ${color.name || "this colour"}`}
                  className="h-10 w-16 cursor-pointer rounded-lg border border-line bg-surface p-1"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, colors: f.colors.filter((_, n) => n !== i) }))
                }
                className="grid size-10 place-items-center rounded-lg text-ink-subtle hover:bg-raised hover:text-rose-500"
                aria-label="Remove this colour"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}

          {form.colors.length < 12 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  colors: [...f.colors, { name: "", hex: "#32457c" }],
                }))
              }
            >
              <Plus className="size-3.5" />
              Add a colour
            </Button>
          )}
        </div>
      </Section>

      <Section
        title="Specifications"
        description="Optional, but these are what buyers filter and compare on — a listing without GSM and composition is much harder to find."
      >
        <Input
          label="GSM"
          inputMode="numeric"
          value={form.specifications.gsm}
          onChange={setSpec("gsm")}
          placeholder="120"
        />
        <Input
          label="Width (inches)"
          inputMode="numeric"
          value={form.specifications.widthInches}
          onChange={setSpec("widthInches")}
          placeholder="58"
        />
        <Input
          label="Composition"
          value={form.specifications.composition}
          onChange={setSpec("composition")}
          placeholder="100% combed cotton"
          className="sm:col-span-2"
        />
        <Input
          label="Weave"
          value={form.specifications.weave}
          onChange={setSpec("weave")}
          placeholder="Plain / poplin"
        />
        <Input
          label="Finish"
          value={form.specifications.finish}
          onChange={setSpec("finish")}
          placeholder="Mercerised, sanforised"
        />
        <Input
          label="Shrinkage"
          value={form.specifications.shrinkage}
          onChange={setSpec("shrinkage")}
          placeholder="Under 2%"
        />
        <Input
          label="Care"
          value={form.specifications.careInstructions}
          onChange={setSpec("careInstructions")}
          placeholder="Machine wash cold, tumble dry low"
        />
        <Input
          label="Certifications"
          value={form.specifications.certifications}
          onChange={setSpec("certifications")}
          hint="Comma separated — GOTS, OEKO-TEX"
          placeholder="GOTS, OEKO-TEX"
          className="sm:col-span-2"
        />
        <Input
          label="Tags"
          value={form.tags}
          onChange={set("tags")}
          hint="Comma separated. Helps keyword search when semantic search is unavailable."
          placeholder="shirting, breathable, summer"
          className="sm:col-span-2"
        />
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-paper/90 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-card sm:border sm:px-5">
        <Button type="submit" size="lg" loading={saving}>
          <Save className="size-[18px]" />
          {productId ? "Save changes" : "Publish listing"}
        </Button>
        <Link
          href="/supplier/products"
          className="text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Cancel
        </Link>
        <p className="ml-auto hidden text-xs text-ink-subtle sm:block">
          Saving re-embeds the listing so semantic search picks it up immediately.
        </p>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {description && (
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
          {description}
        </p>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

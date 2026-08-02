"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Save, TriangleAlert } from "lucide-react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import {
  BUSINESS_TYPES,
  FABRIC_TYPES,
  PRODUCT_CATEGORIES,
} from "@/server/constants/marketplace";
import { cn } from "@/lib/cn";

/**
 * The business profile editor.
 *
 * Onboarding writes this record in one conversational pass and offers three
 * opening-hours presets; this is where a supplier sets Tuesday to the minute,
 * corrects a phone number, or adds a category — the field-by-field editor the
 * brief asks for. Both write the same document.
 */

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type DayHours = { open: string; close: string; closed: boolean };

export type BusinessProfileValues = {
  businessName: string;
  businessType: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  operatingHours: Record<(typeof DAYS)[number], DayHours>;
  categories: string[];
  fabricTypes: string[];
  minimumOrderQuantity: string;
  gstNumber: string;
  yearEstablished: string;
};

export function BusinessProfileForm({
  initial,
}: {
  initial: BusinessProfileValues;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set =
    <K extends keyof BusinessProfileValues>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setErrors((f) => ({ ...f, [key]: "" }));
    };

  const setAddress =
    (key: keyof BusinessProfileValues["address"]) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, address: { ...f.address, [key]: e.target.value } }));
      setErrors((f) => ({ ...f, [`address.${key}`]: "" }));
    };

  function setDay(day: (typeof DAYS)[number], patch: Partial<DayHours>) {
    setForm((f) => ({
      ...f,
      operatingHours: {
        ...f.operatingHours,
        [day]: { ...f.operatingHours[day], ...patch },
      },
    }));
  }

  function toggle(key: "categories" | "fabricTypes", value: string) {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value)
        ? f[key].filter((v) => v !== value)
        : [...f[key], value],
    }));
    setErrors((f) => ({ ...f, [key]: "" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFailure(null);
    setErrors({});

    try {
      await api.patch("/api/supplier/profile", {
        businessName: form.businessName.trim(),
        businessType: form.businessType,
        description: form.description.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim(),
        website: form.website.trim(),
        address: {
          line1: form.address.line1.trim(),
          line2: form.address.line2.trim(),
          city: form.address.city.trim(),
          state: form.address.state.trim(),
          postalCode: form.address.postalCode.trim(),
          country: form.address.country.trim() || "India",
        },
        operatingHours: form.operatingHours,
        categories: form.categories,
        fabricTypes: form.fabricTypes,
        minimumOrderQuantity: form.minimumOrderQuantity,
        ...(form.gstNumber.trim() ? { gstNumber: form.gstNumber.trim() } : {}),
        ...(form.yearEstablished.trim()
          ? { yearEstablished: form.yearEstablished.trim() }
          : {}),
      });

      router.push("/supplier/profile");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setFailure(err.message);
        setErrors(err.fieldErrors);
      } else {
        setFailure("Could not save your profile. Please try again.");
      }
      setSaving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

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

      <Section title="Business">
        <Input
          label="Business name"
          required
          value={form.businessName}
          onChange={set("businessName")}
          error={errors.businessName}
          className="sm:col-span-2"
          hint="Your storefront URL does not change when you rename — existing product links keep working"
        />
        <Select
          label="Business type"
          value={form.businessType}
          onChange={set("businessType")}
          error={errors.businessType}
          options={BUSINESS_TYPES.map((b) => ({ value: b, label: b }))}
        />
        <Input
          label="Year established"
          inputMode="numeric"
          value={form.yearEstablished}
          onChange={set("yearEstablished")}
          error={errors.yearEstablished}
          placeholder="1987"
        />
        <Textarea
          label="About the business"
          rows={4}
          value={form.description}
          onChange={set("description")}
          error={errors.description}
          hint="Shown on your storefront and every product page"
          className="sm:col-span-2"
        />
        <Input
          label="GST number"
          value={form.gstNumber}
          onChange={set("gstNumber")}
          error={errors.gstNumber}
          hint="Optional"
          className="sm:col-span-2"
        />
      </Section>

      <Section title="Contact">
        <Input
          label="Orders email"
          type="email"
          required
          value={form.contactEmail}
          onChange={set("contactEmail")}
          error={errors.contactEmail}
        />
        <Input
          label="Phone"
          type="tel"
          required
          value={form.contactPhone}
          onChange={set("contactPhone")}
          error={errors.contactPhone}
        />
        <Input
          label="Website"
          value={form.website}
          onChange={set("website")}
          error={errors.website}
          hint="Optional"
          className="sm:col-span-2"
        />
      </Section>

      <Section title="Ships from">
        <Input
          label="Address"
          required
          value={form.address.line1}
          onChange={setAddress("line1")}
          error={errors["address.line1"]}
          className="sm:col-span-2"
        />
        <Input
          label="Address line 2"
          value={form.address.line2}
          onChange={setAddress("line2")}
          hint="Optional"
          className="sm:col-span-2"
        />
        <Input
          label="City"
          required
          value={form.address.city}
          onChange={setAddress("city")}
          error={errors["address.city"]}
        />
        <Input
          label="State"
          required
          value={form.address.state}
          onChange={setAddress("state")}
          error={errors["address.state"]}
        />
        <Input
          label="PIN code"
          required
          inputMode="numeric"
          value={form.address.postalCode}
          onChange={setAddress("postalCode")}
          error={errors["address.postalCode"]}
        />
        <Input
          label="Country"
          value={form.address.country}
          onChange={setAddress("country")}
        />
      </Section>

      <Section
        title="Operating hours"
        description="Buyers see these on your storefront. Onboarding sets a preset — this is where you correct a single day."
      >
        <div className="space-y-2 sm:col-span-2">
          {DAYS.map((day) => {
            const hours = form.operatingHours[day];
            return (
              <div
                key={day}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2"
              >
                <span className="w-24 shrink-0 text-sm capitalize text-ink">
                  {day}
                </span>

                <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    checked={hours.closed}
                    onChange={(e) => setDay(day, { closed: e.target.checked })}
                    className="size-3.5 accent-indigo-600"
                  />
                  Closed
                </label>

                <div
                  className={cn(
                    "flex items-center gap-2",
                    hours.closed && "pointer-events-none opacity-40",
                  )}
                >
                  <input
                    type="time"
                    value={hours.open}
                    onChange={(e) => setDay(day, { open: e.target.value })}
                    aria-label={`${day} opening time`}
                    className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink tnum focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <span className="text-xs text-ink-subtle">to</span>
                  <input
                    type="time"
                    value={hours.close}
                    onChange={(e) => setDay(day, { close: e.target.value })}
                    aria-label={`${day} closing time`}
                    className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink tnum focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="What you supply"
        description="Buyers filter on these, so they decide how often you turn up in results."
      >
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-ink">
            Categories
            {errors.categories && (
              <span className="ml-2 text-xs font-normal text-rose-500">
                {errors.categories}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {PRODUCT_CATEGORIES.map((category) => (
              <Chip
                key={category}
                selected={form.categories.includes(category)}
                onClick={() => toggle("categories", category)}
              >
                {category}
              </Chip>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-ink">Construction</p>
          <div className="flex flex-wrap gap-2">
            {FABRIC_TYPES.map((type) => (
              <Chip
                key={type}
                selected={form.fabricTypes.includes(type)}
                onClick={() => toggle("fabricTypes", type)}
              >
                {type}
              </Chip>
            ))}
          </div>
        </div>

        <Input
          label="Business minimum order quantity"
          inputMode="numeric"
          value={form.minimumOrderQuantity}
          onChange={set("minimumOrderQuantity")}
          error={errors.minimumOrderQuantity}
          hint="Individual listings can set a tighter MOQ"
        />
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-paper/90 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-card sm:border sm:px-5">
        <Button type="submit" size="lg" loading={saving}>
          <Save className="size-[18px]" />
          Save profile
        </Button>
        <Link
          href="/supplier/profile"
          className="text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Cancel
        </Link>
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

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
        selected
          ? "border-indigo-400 bg-indigo-50 font-medium text-indigo-600"
          : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
      )}
    >
      {selected && <Check className="size-3.5" />}
      {children}
    </button>
  );
}

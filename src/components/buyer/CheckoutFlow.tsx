"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  ReceiptText,
  ShieldCheck,
  Store,
  TriangleAlert,
} from "lucide-react";
import { Button, Input, LinkButton, Skeleton, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { cn, formatPrice } from "@/lib/cn";
import { cdnImage } from "@/lib/image";
import { useCart } from "@/store/cart";
import type { CartState } from "@/types";

/**
 * Two-step checkout: shipping details, then a review of exactly what will be
 * placed. No payment step — the brief puts payments out of scope, and pretending
 * otherwise would be a worse prototype, not a better one.
 *
 * The supplier split is shown again on review because it changes what the buyer
 * is agreeing to: several orders, each confirmed and dispatched separately.
 */

type Address = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

const EMPTY_ADDRESS: Address = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
};

type PlacedOrder = {
  orderNumber: string;
  supplier?: { id: string; name: string; slug: string };
  total: number;
  itemCount: number;
};

const PHONE = /^[0-9+\-\s()]{7,20}$/;
const PIN = /^[0-9]{6}$/;

function validate(address: Address): Record<string, string> {
  const errors: Record<string, string> = {};
  if (address.fullName.trim().length < 2) errors.fullName = "Name is required";
  if (!PHONE.test(address.phone.trim())) errors.phone = "Enter a valid phone number";
  if (address.line1.trim().length < 3) errors.line1 = "Address is required";
  if (address.city.trim().length < 2) errors.city = "City is required";
  if (address.state.trim().length < 2) errors.state = "State is required";
  if (!PIN.test(address.postalCode.trim())) errors.postalCode = "Enter a 6-digit PIN code";
  return errors;
}

export function CheckoutFlow({
  defaultName,
  defaultPhone,
}: {
  defaultName: string;
  defaultPhone: string;
}) {
  const router = useRouter();
  const cart = useCart((s) => s.cart);
  const loading = useCart((s) => s.loading);
  const load = useCart((s) => s.load);

  const [step, setStep] = useState<"shipping" | "review">("shipping");
  const [address, setAddress] = useState<Address>({
    ...EMPTY_ADDRESS,
    fullName: defaultName,
    phone: defaultPhone,
  });
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !cart.items.length) return <CheckoutSkeleton />;

  // An empty cart here means the order was placed in another tab, or the last
  // line was removed — either way there is nothing to check out.
  if (!cart.items.length) {
    return (
      <div className="rounded-card border border-dashed border-line px-6 py-16 text-center">
        <p className="text-base font-medium text-ink">There&rsquo;s nothing to check out</p>
        <p className="mt-1.5 text-sm text-ink-muted">
          Add a few fabrics to your cart and come back.
        </p>
        <LinkButton href="/products" className="mt-6">
          Browse fabrics
        </LinkButton>
      </div>
    );
  }

  function toReview(e: React.FormEvent) {
    e.preventDefault();
    const problems = validate(address);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function place() {
    setPlacing(true);
    setFailure(null);

    try {
      const result = await api.post<{
        checkoutGroupId: string;
        orders: PlacedOrder[];
        grandTotal: number;
      }>("/api/orders", {
        shippingAddress: {
          fullName: address.fullName.trim(),
          phone: address.phone.trim(),
          line1: address.line1.trim(),
          line2: address.line2.trim() || undefined,
          city: address.city.trim(),
          state: address.state.trim(),
          postalCode: address.postalCode.trim(),
          country: "India",
        },
        buyerNote: note.trim() || undefined,
      });

      // The server emptied the cart; mirror that locally so the header badge
      // clears before the confirmation page paints.
      useCart.getState().reset();
      router.push(`/checkout/confirmation/${result.checkoutGroupId}`);
    } catch (err) {
      // Stock can go in the seconds between reviewing and confirming, so send
      // the buyer back to the cart where the failing line is marked.
      if (err instanceof ApiError) {
        setFailure(err.message);
        if (err.code === "CART_HAS_ISSUES" || err.code === "INSUFFICIENT_STOCK") {
          await load();
        }
      } else {
        setFailure("Could not place your order. Please try again.");
      }
      setPlacing(false);
    }
  }

  const set = (key: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress((a) => ({ ...a, [key]: e.target.value }));
    setErrors((f) => ({ ...f, [key]: "" }));
  };

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Steps active={step} />

        {failure && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-500"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              {failure}{" "}
              <Link href="/cart" className="font-medium underline underline-offset-2">
                Review your cart
              </Link>
            </span>
          </p>
        )}

        {step === "shipping" ? (
          <form
            onSubmit={toReview}
            className="space-y-5 rounded-card border border-line bg-surface p-5 sm:p-6"
          >
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-ink-subtle" />
              <h2 className="text-sm font-semibold text-ink">Shipping details</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Contact name"
                required
                autoComplete="name"
                value={address.fullName}
                onChange={set("fullName")}
                error={errors.fullName}
              />
              <Input
                label="Phone"
                required
                type="tel"
                autoComplete="tel"
                value={address.phone}
                onChange={set("phone")}
                error={errors.phone}
                placeholder="+91 98450 00000"
              />
              <Input
                className="sm:col-span-2"
                label="Address"
                required
                autoComplete="address-line1"
                value={address.line1}
                onChange={set("line1")}
                error={errors.line1}
                placeholder="Unit 4, Ambattur Industrial Estate"
              />
              <Input
                className="sm:col-span-2"
                label="Address line 2"
                autoComplete="address-line2"
                value={address.line2}
                onChange={set("line2")}
                hint="Optional"
              />
              <Input
                label="City"
                required
                autoComplete="address-level2"
                value={address.city}
                onChange={set("city")}
                error={errors.city}
              />
              <Input
                label="State"
                required
                autoComplete="address-level1"
                value={address.state}
                onChange={set("state")}
                error={errors.state}
              />
              <Input
                label="PIN code"
                required
                inputMode="numeric"
                autoComplete="postal-code"
                value={address.postalCode}
                onChange={set("postalCode")}
                error={errors.postalCode}
                placeholder="600053"
              />
            </div>

            <Textarea
              label="Note for the supplier"
              hint="Optional — delivery windows, lab-dip requirements, PO references"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Please share a lab dip before bulk production."
            />

            <Button type="submit" size="lg" className="w-full sm:w-auto">
              Review order
              <ArrowRight className="size-[18px]" />
            </Button>
          </form>
        ) : (
          <Review
            cart={cart}
            address={address}
            note={note}
            onBack={() => setStep("shipping")}
          />
        )}
      </div>

      <aside className="lg:sticky lg:top-24">
        <div className="rounded-card border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">
            {cart.groups.length > 1
              ? `${cart.groups.length} orders · ${cart.lineCount} items`
              : `${cart.lineCount} items`}
          </h2>

          <dl className="mt-4 space-y-2.5 text-sm">
            <SummaryRow label="Subtotal">{formatPrice(cart.subtotal)}</SummaryRow>
            <SummaryRow label="GST (5%)">{formatPrice(cart.taxAmount)}</SummaryRow>
            <SummaryRow label="Shipping">
              <span className="text-moss-600">Quoted by supplier</span>
            </SummaryRow>
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="text-sm font-medium text-ink">Total</dt>
              <dd className="font-display text-2xl text-ink tnum">
                {formatPrice(cart.total)}
              </dd>
            </div>
          </dl>

          {step === "review" && (
            <Button
              size="lg"
              className="mt-5 w-full"
              onClick={place}
              loading={placing}
            >
              <Check className="size-[18px]" />
              Place order
            </Button>
          )}

          <p className="mt-4 flex items-start gap-2 text-xs text-ink-subtle">
            <ShieldCheck className="mt-px size-3.5 shrink-0" />
            No payment is taken. Each supplier confirms their order and quotes
            freight before dispatch.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Review({
  cart,
  address,
  note,
  onBack,
}: {
  cart: CartState;
  address: Address;
  note: string;
  onBack: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-card border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-ink-subtle" />
            <h2 className="text-sm font-semibold text-ink">Shipping to</h2>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-indigo-600 underline-offset-2 hover:underline"
          >
            Change
          </button>
        </div>

        <address className="mt-3 text-sm not-italic leading-relaxed text-ink-muted">
          <span className="font-medium text-ink">{address.fullName}</span>
          <br />
          {address.line1}
          {address.line2 && (
            <>
              <br />
              {address.line2}
            </>
          )}
          <br />
          {address.city}, {address.state} {address.postalCode}
          <br />
          {address.phone}
        </address>

        {note && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-raised p-3 text-sm text-ink-muted">
            <ReceiptText className="mt-0.5 size-4 shrink-0 text-ink-subtle" />
            {note}
          </p>
        )}
      </div>

      {cart.groups.map((group, i) => (
        <section
          key={group.supplier.id}
          className="overflow-hidden rounded-card border border-line bg-surface"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line bg-raised/60 px-4 py-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
              <Store className="size-4 shrink-0 text-ink-subtle" />
              <span className="truncate">{group.supplier.name}</span>
            </span>
            {cart.groups.length > 1 && (
              <span className="shrink-0 text-xs text-ink-subtle">
                Order {i + 1} of {cart.groups.length}
              </span>
            )}
          </header>

          <ul className="divide-y divide-line">
            {group.items.map((item) => (
              <li
                key={`${item.productId}-${item.color ?? ""}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-raised">
                  {item.image && (
                    <Image
                      src={cdnImage(item.image, { width: 120, height: 120 })}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{item.name}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle tnum">
                    {item.quantity} {item.unit} × {formatPrice(item.unitPrice)}
                    {item.color && ` · ${item.color}`}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-ink tnum">
                  {formatPrice(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-baseline justify-between border-t border-line px-4 py-3 text-sm">
            <span className="text-ink-muted">Supplier subtotal</span>
            <span className="font-medium text-ink tnum">
              {formatPrice(group.subtotal)}
            </span>
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Back to shipping details
      </button>
    </div>
  );
}

function Steps({ active }: { active: "shipping" | "review" }) {
  const steps = [
    { id: "shipping", label: "Shipping" },
    { id: "review", label: "Review" },
    { id: "done", label: "Confirmation" },
  ];
  const activeIndex = steps.findIndex((s) => s.id === active);

  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((step, i) => (
        <li key={step.id} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
              i < activeIndex && "bg-moss-500 text-white",
              i === activeIndex && "bg-indigo-600 text-white dark:bg-indigo-500",
              i > activeIndex && "border border-line text-ink-subtle",
            )}
            aria-current={i === activeIndex ? "step" : undefined}
          >
            {i < activeIndex ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span
            className={cn(
              "truncate",
              i === activeIndex ? "font-medium text-ink" : "text-ink-subtle",
            )}
          >
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <span className="h-px flex-1 bg-line" aria-hidden />
          )}
        </li>
      ))}
    </ol>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink tnum">{children}</dd>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_340px]">
      <Skeleton className="h-96 rounded-card" />
      <Skeleton className="h-64 rounded-card" />
    </div>
  );
}

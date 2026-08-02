import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  IndianRupee,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { OrderRow } from "@/components/buyer/OrderRow";
import { Badge, EmptyState, LinkButton } from "@/components/ui";
import { getSession } from "@/server/middleware/session";
import { buyerDashboard } from "@/server/services/order.service";
import { getOnboardingState } from "@/server/services/onboarding.service";
import { formatPrice } from "@/lib/cn";
import { serialize } from "@/lib/serialize";
import type { BuyerPreferences, Order } from "@/types";

export const metadata: Metadata = {
  title: "Your dashboard",
  description: "Open orders, purchase history and your sourcing profile.",
};

export const dynamic = "force-dynamic";

export default async function BuyerDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fbuyer");
  if (session.role !== "buyer") redirect("/supplier");

  const [dashboard, state] = await Promise.all([
    buyerDashboard(session.sub),
    getOnboardingState(session.sub),
  ]);

  const open = serialize<Order[]>(dashboard.openOrders);
  const past = serialize<Order[]>(dashboard.pastOrders);
  const preferences =
    state.role === "buyer"
      ? serialize<BuyerPreferences | null>(state.buyerPreferences)
      : null;
  const { stats } = dashboard;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">
            Good to see you, {session.name.split(" ")[0]}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {stats.active > 0
              ? `You have ${stats.active} order${stats.active === 1 ? "" : "s"} in progress.`
              : "Nothing in progress right now — a good time to restock."}
          </p>
        </div>
        <LinkButton href="/products">
          Browse fabrics
          <ArrowRight className="size-[18px]" />
        </LinkButton>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          icon={<Truck className="size-4" />}
          label="In progress"
          value={String(stats.active)}
        />
        <Stat
          icon={<PackageCheck className="size-4" />}
          label="Completed"
          value={String(stats.completed)}
        />
        <Stat
          icon={<ShoppingBag className="size-4" />}
          label="Orders placed"
          value={String(stats.total)}
        />
        <Stat
          icon={<IndianRupee className="size-4" />}
          label="Total ordered"
          value={formatPrice(stats.spend)}
        />
      </div>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-10">
          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-xl text-ink">Current orders</h2>
              {open.length > 0 && (
                <Link
                  href="/orders"
                  className="text-sm text-indigo-600 underline-offset-2 hover:underline"
                >
                  View all
                </Link>
              )}
            </div>

            {open.length === 0 ? (
              <EmptyState
                icon={<Truck className="size-6" />}
                title="No orders in progress"
                description="Orders you place will show up here until the supplier marks them completed."
                action={
                  <LinkButton href="/products" variant="secondary">
                    Find fabric
                  </LinkButton>
                }
              />
            ) : (
              <div className="space-y-3">
                {open.map((order) => (
                  <OrderRow key={order._id} order={order} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display text-xl text-ink">Order history</h2>
                <Link
                  href="/orders"
                  className="text-sm text-indigo-600 underline-offset-2 hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {past.map((order) => (
                  <OrderRow key={order._id} order={order} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <SourcingProfile preferences={preferences} name={session.name} />
        </aside>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
        <span className="text-ink-subtle">{icon}</span>
        {label}
      </span>
      <p className="mt-2 font-display text-2xl text-ink tnum">{value}</p>
    </div>
  );
}

/**
 * The answers from onboarding, shown back to the buyer. Surfacing them here is
 * what makes the conversation feel like it did something — and it is the same
 * data the assistant reasons over when recommending fabric.
 */
function SourcingProfile({
  preferences,
  name,
}: {
  preferences: BuyerPreferences | null;
  name: string;
}) {
  if (!preferences) {
    return (
      <div className="rounded-card border border-dashed border-line p-5 text-center">
        <p className="text-sm font-medium text-ink">Tune your catalog</p>
        <p className="mt-1.5 text-xs text-ink-muted">
          Tell us what you source and the marketplace will lead with it.
        </p>
        <LinkButton href="/onboarding" size="sm" className="mt-4">
          <Sparkles className="size-3.5" />
          Set up in a minute
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">Sourcing profile</h2>
          <p className="mt-0.5 truncate text-xs text-ink-subtle">{name}</p>
        </div>
        <Link
          href="/onboarding"
          className="shrink-0 text-xs text-indigo-600 underline-offset-2 hover:underline"
        >
          Edit
        </Link>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        {preferences.businessType && (
          <Detail label="Business">{preferences.businessType}</Detail>
        )}
        {preferences.industry && (
          <Detail label="Industry">{preferences.industry}</Detail>
        )}
        {preferences.typicalOrderQuantity && (
          <Detail label="Typical order">{preferences.typicalOrderQuantity}</Detail>
        )}
        {preferences.budgetRange && (
          <Detail label="Budget">{preferences.budgetRange}</Detail>
        )}
      </dl>

      {preferences.interestedCategories?.length ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-xs text-ink-subtle">Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {preferences.interestedCategories.map((category) => (
              <Link key={category} href={`/products?category=${encodeURIComponent(category)}`}>
                <Badge tone="indigo">{category}</Badge>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {preferences.preferredFabricTypes?.length ? (
        <div className="mt-4">
          <p className="mb-2 text-xs text-ink-subtle">Construction</p>
          <div className="flex flex-wrap gap-1.5">
            {preferences.preferredFabricTypes.map((type) => (
              <Badge key={type}>{type}</Badge>
            ))}
          </div>
        </div>
      ) : null}

      {preferences.notes && (
        <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">
          {preferences.notes}
        </p>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-ink-subtle">{label}</dt>
      <dd className="text-right text-sm text-ink">{children}</dd>
    </div>
  );
}

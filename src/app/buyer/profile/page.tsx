import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Phone, Sparkles, UserRound } from "lucide-react";
import { Badge, LinkButton } from "@/components/ui";
import { connectDB } from "@/server/lib/db";
import { getSession } from "@/server/middleware/session";
import { User } from "@/server/models";
import { formatDate } from "@/lib/cn";
import { serialize } from "@/lib/serialize";
import type { BuyerPreferences } from "@/types";

export const metadata: Metadata = {
  title: "Your profile",
  description: "Account details and the sourcing preferences the catalog uses.",
};

export const dynamic = "force-dynamic";

export default async function BuyerProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fbuyer%2Fprofile");
  if (session.role !== "buyer") redirect("/supplier/profile");

  await connectDB();
  const user = await User.findById(session.sub)
    .select("name email phone createdAt buyerPreferences")
    .lean();
  if (!user) redirect("/login");

  const preferences = serialize<BuyerPreferences | null>(
    user.buyerPreferences ?? null,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Your profile</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Account details, and the preferences the marketplace personalises on.
        </p>
      </header>

      <section className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-600">
            {user.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-medium text-ink">{user.name}</p>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Buyer account
              {user.createdAt && ` · joined ${formatDate(user.createdAt)}`}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <Mail className="mt-0.5 size-4 shrink-0 text-ink-subtle" />
            <div className="min-w-0">
              <dt className="text-xs text-ink-subtle">Email</dt>
              <dd className="truncate text-sm text-ink">{user.email}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Phone className="mt-0.5 size-4 shrink-0 text-ink-subtle" />
            <div className="min-w-0">
              <dt className="text-xs text-ink-subtle">Phone</dt>
              <dd className="truncate text-sm text-ink">
                {user.phone || <span className="text-ink-subtle">Not added</span>}
              </dd>
            </div>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-card border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <UserRound className="size-4 text-ink-subtle" />
              Sourcing preferences
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              These shape recommendations, search ranking and your default browse view.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="text-sm text-indigo-600 underline-offset-2 hover:underline"
          >
            Update
          </Link>
        </div>

        {!preferences ? (
          <div className="mt-5 rounded-lg border border-dashed border-line px-4 py-8 text-center">
            <p className="text-sm text-ink-muted">
              You haven&rsquo;t set these up yet.
            </p>
            <LinkButton href="/onboarding" size="sm" className="mt-4">
              <Sparkles className="size-3.5" />
              Take the two-minute setup
            </LinkButton>
          </div>
        ) : (
          <dl className="mt-5 divide-y divide-line border-t border-line">
            <Row label="Business type">{preferences.businessType}</Row>
            <Row label="Industry">{preferences.industry}</Row>
            <Row label="Categories">
              {preferences.interestedCategories?.length ? (
                <span className="flex flex-wrap justify-end gap-1.5">
                  {preferences.interestedCategories.map((c) => (
                    <Badge key={c} tone="indigo">
                      {c}
                    </Badge>
                  ))}
                </span>
              ) : null}
            </Row>
            <Row label="Construction">
              {preferences.preferredFabricTypes?.length ? (
                <span className="flex flex-wrap justify-end gap-1.5">
                  {preferences.preferredFabricTypes.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </span>
              ) : null}
            </Row>
            <Row label="Typical order">{preferences.typicalOrderQuantity}</Row>
            <Row label="Budget">{preferences.budgetRange}</Row>
            <Row label="Notes">{preferences.notes}</Row>
          </dl>
        )}
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <dt className="shrink-0 text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-ink">
        {children || <span className="text-ink-subtle">Not set</span>}
      </dd>
    </div>
  );
}

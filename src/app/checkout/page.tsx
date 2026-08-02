import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutFlow } from "@/components/buyer/CheckoutFlow";
import { connectDB } from "@/server/lib/db";
import { getSession } from "@/server/middleware/session";
import { User } from "@/server/models";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Confirm shipping details and place your order.",
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fcheckout");
  if (session.role !== "buyer") redirect("/supplier");

  // Pre-fills the contact fields — a buyer who just registered should not have
  // to type their own name and number back at us.
  await connectDB();
  const user = await User.findById(session.sub).select("name phone").lean();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Checkout</h1>
        <p className="mt-2 text-sm text-ink-muted">
          No payment is taken in this prototype — suppliers confirm each order
          and quote freight before dispatch.
        </p>
      </header>

      <CheckoutFlow
        defaultName={user?.name ?? session.name}
        defaultPhone={user?.phone ?? ""}
      />
    </div>
  );
}

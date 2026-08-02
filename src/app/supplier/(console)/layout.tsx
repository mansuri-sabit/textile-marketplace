import { Types } from "mongoose";
import { redirect } from "next/navigation";
import { ConsoleNav } from "@/components/supplier/ConsoleNav";
import { connectDB } from "@/server/lib/db";
import { getSession } from "@/server/middleware/session";
import { SupplierProfile } from "@/server/models";

/**
 * Shell for the supplier console — dashboard, inventory, orders, profile.
 *
 * `/supplier/onboarding` sits outside this route group on purpose: it must stay
 * reachable before a profile exists, and it reads better without the console
 * chrome around it.
 *
 * The profile check here is a redirect, not a security boundary. Every supplier
 * API re-derives the profile through `requireSupplierProfile` and refuses
 * without one, which is what actually stops a write.
 */
export default async function SupplierConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fsupplier");
  if (session.role !== "supplier") redirect("/");

  await connectDB();
  const profile = await SupplierProfile.findOne({
    user: new Types.ObjectId(session.sub),
  })
    .select("_id")
    .lean();

  // Onboarding only marks itself complete after creating the profile, so this
  // should be unreachable — but landing on a console that 409s on every panel
  // would be a worse failure than being sent back to finish setup.
  if (!profile) redirect("/supplier/onboarding");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ConsoleNav />
      {children}
    </div>
  );
}

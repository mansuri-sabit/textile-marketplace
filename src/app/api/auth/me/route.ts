import type { NextRequest } from "next/server";
import { connectDB } from "@/server/lib/db";
import { ok, route } from "@/server/lib/api";
import { getSession, requireAuth } from "@/server/middleware/session";
import { User } from "@/server/models";
import { updateBuyerAccount } from "@/server/services/profile.service";
import { buyerAccountSchema } from "@/server/validators/profile";

export const runtime = "nodejs";

/**
 * Returns the signed-in user, or `{ user: null }` with a 200 when nobody is
 * signed in. Anonymous browsing is a normal state on a marketplace homepage —
 * a 401 here would make the client treat it as an error.
 */
export const GET = route(async () => {
  const session = await getSession();
  if (!session) return ok({ user: null });

  await connectDB();
  const user = await User.findById(session.sub).lean();
  if (!user) return ok({ user: null });

  return ok({
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone ?? null,
      avatarUrl: user.avatarUrl ?? null,
      onboardingCompleted: user.onboardingCompleted ?? false,
      buyerPreferences: user.buyerPreferences ?? null,
    },
  });
});

/**
 * PATCH /api/auth/me — edit your own account.
 *
 * The id comes from the cookie, never the body, so this can only ever write
 * the caller's own record. Email is not editable: it is the login identity and
 * changing it needs a verification flow this prototype does not have.
 */
export const PATCH = route(async (req: NextRequest) => {
  const session = await requireAuth();
  const input = buyerAccountSchema.parse(await req.json());
  return ok({ user: await updateBuyerAccount(session.sub, input) });
});

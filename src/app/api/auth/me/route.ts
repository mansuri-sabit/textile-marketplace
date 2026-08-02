import { connectDB } from "@/server/lib/db";
import { ok, route } from "@/server/lib/api";
import { getSession } from "@/server/middleware/session";
import { User } from "@/server/models";

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

import { cookies } from "next/headers";
import { AppError, fail, ok, route } from "@/server/lib/api";
import { clearAuthCookies, setAuthCookies } from "@/server/lib/cookies";
import { REFRESH_COOKIE, verifyRefreshToken } from "@/server/lib/tokens";
import { refreshSession } from "@/server/services/auth.service";

export const runtime = "nodejs";

const expired = () =>
  clearAuthCookies(fail("SESSION_EXPIRED", "Please sign in again.", 401));

/**
 * Called by the client when a request 401s on an expired access token.
 * Every failure path clears the cookies, so a dead session cannot leave the
 * browser retrying forever with a token that will never work again.
 */
export const POST = route(async () => {
  const store = await cookies();
  const token = store.get(REFRESH_COOKIE)?.value;
  if (!token) return expired();

  const claims = await verifyRefreshToken(token);
  if (!claims) return expired();

  try {
    const { user, tokens } = await refreshSession(claims.sub, claims.tv);
    return setAuthCookies(ok({ user }), tokens);
  } catch (err) {
    // Well-formed token that is no longer valid: user deleted, or logged out
    // everywhere since it was issued.
    if (err instanceof AppError) return expired();
    throw err;
  }
});

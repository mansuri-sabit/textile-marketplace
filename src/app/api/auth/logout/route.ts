import { ok, route } from "@/server/lib/api";
import { clearAuthCookies } from "@/server/lib/cookies";

export const runtime = "nodejs";

// Deliberately succeeds even without a valid session: logging out should never
// fail, and an already-expired token is not an error worth surfacing.
export const POST = route(async () => {
  return clearAuthCookies(ok({ loggedOut: true }));
});

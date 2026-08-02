import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, verifyAccessTokenEdge } from "@/server/lib/tokens";

/**
 * Route guards, evaluated at the edge before any page renders.
 * (Next.js 16 renamed this convention from `middleware.ts` to `proxy.ts`.)
 *
 * This is a redirect layer for user experience, not the security boundary —
 * every API route re-checks the session server-side via `requireRole`. Relying
 * on this file alone would leave the API open to direct calls.
 */

/**
 * Everything not listed below is public: the marketplace homepage, product
 * pages, and supplier storefronts must stay browsable without an account.
 */
const BUYER_PREFIXES = ["/buyer", "/cart", "/checkout", "/orders"];
const SUPPLIER_PREFIXES = ["/supplier"];

/** Onboarding itself must stay reachable while onboarding is incomplete. */
const ONBOARDING_PATHS = ["/onboarding", "/supplier/onboarding"];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(p === "/" ? "//" : `${p}/`),
  );
}

function redirect(req: NextRequest, to: string): NextResponse {
  return NextResponse.redirect(new URL(to, req.url));
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  const secret = process.env.JWT_ACCESS_SECRET;
  const session =
    token && secret ? await verifyAccessTokenEdge(token, secret) : null;

  const isAuthPage = pathname === "/login" || pathname === "/register";

  // Already signed in — no reason to show the login form again.
  if (session && isAuthPage) {
    return redirect(req, session.role === "supplier" ? "/supplier" : "/");
  }

  const needsBuyer = matches(pathname, BUYER_PREFIXES);
  const needsSupplier = matches(pathname, SUPPLIER_PREFIXES);
  const isOnboarding = ONBOARDING_PATHS.includes(pathname);
  const isProtected = needsBuyer || needsSupplier || isOnboarding;

  if (!isProtected) return NextResponse.next();

  if (!session) {
    // Preserve the destination so login can bounce the user back to it.
    const next = encodeURIComponent(pathname + search);
    return redirect(req, `/login?next=${next}`);
  }

  if (needsBuyer && session.role !== "buyer") {
    return redirect(req, "/supplier");
  }

  if (needsSupplier && session.role !== "supplier") {
    return redirect(req, "/");
  }

  // Force new accounts through onboarding before anything else, since the whole
  // buyer experience is personalised from what it collects.
  if (!session.onboardingCompleted && !isOnboarding) {
    return redirect(
      req,
      session.role === "supplier" ? "/supplier/onboarding" : "/onboarding",
    );
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Skip API routes (they guard themselves and must return JSON, not a
   * redirect), Next internals, and anything that looks like a static file.
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

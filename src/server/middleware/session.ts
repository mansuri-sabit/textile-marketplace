import { cookies } from "next/headers";
import type { UserRole } from "../constants/marketplace";
import { AppError } from "../lib/api";
import {
  ACCESS_COOKIE,
  verifyAccessToken,
  type AccessClaims,
} from "../lib/tokens";

/**
 * Session helpers for route handlers and server components.
 *
 * These read the access token only — no database round-trip — so an authorised
 * endpoint costs nothing extra. Anything that must reflect live user state
 * (a role change, a ban) should re-read the user in its own service.
 */

export async function getSession(): Promise<AccessClaims | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

export async function requireAuth(): Promise<AccessClaims> {
  const session = await getSession();
  if (!session) {
    throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  }
  return session;
}

/**
 * Role gate. Returns 403 rather than 401 when the user is signed in but wearing
 * the wrong hat, so the client can show "not your area" instead of a login box.
 */
export async function requireRole(role: UserRole): Promise<AccessClaims> {
  const session = await requireAuth();
  if (session.role !== role) {
    throw new AppError(
      "FORBIDDEN",
      `This action is only available to ${role} accounts.`,
      403,
    );
  }
  return session;
}

export const requireBuyer = () => requireRole("buyer");
export const requireSupplier = () => requireRole("supplier");

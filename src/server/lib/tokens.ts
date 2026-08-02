import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { UserRole } from "../constants/marketplace";
import { env } from "./env";

/**
 * JWT helpers built on `jose` rather than `jsonwebtoken` because the Edge
 * middleware verifies access tokens on every navigation, and `jsonwebtoken`
 * depends on Node crypto that the Edge runtime does not provide.
 */

export const ACCESS_COOKIE = "mkt_at";
export const REFRESH_COOKIE = "mkt_rt";

export type AccessClaims = {
  sub: string;
  role: UserRole;
  name: string;
  onboardingCompleted: boolean;
};

export type RefreshClaims = {
  sub: string;
  /** Must match the user's current `tokenVersion` or the token is dead. */
  tv: number;
};

function secret(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/**
 * `iat` only has second resolution, so two tokens minted for the same user
 * within the same second would otherwise be byte-identical. A unique `jti`
 * guarantees every issued token is distinct — which makes refresh rotation
 * observable and leaves room for a revocation list later.
 */
export async function signAccessToken(claims: AccessClaims): Promise<string> {
  const { JWT_ACCESS_SECRET, ACCESS_TOKEN_TTL } = env();
  return new SignJWT({ ...claims } as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(secret(JWT_ACCESS_SECRET));
}

export async function signRefreshToken(claims: RefreshClaims): Promise<string> {
  const { JWT_REFRESH_SECRET, REFRESH_TOKEN_TTL } = env();
  return new SignJWT({ tv: claims.tv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(secret(JWT_REFRESH_SECRET));
}

/** Returns null on any failure — expired, tampered, or wrong secret. */
export async function verifyAccessToken(
  token: string,
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(env().JWT_ACCESS_SECRET));
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      sub: payload.sub,
      role: payload.role as UserRole,
      name: (payload.name as string) ?? "",
      onboardingCompleted: Boolean(payload.onboardingCompleted),
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(env().JWT_REFRESH_SECRET));
    if (!payload.sub || typeof payload.tv !== "number") return null;
    return { sub: payload.sub, tv: payload.tv };
  } catch {
    return null;
  }
}

/**
 * Edge-safe variant: the middleware only has the raw secret string available
 * and must not import the full env schema (which reads Node-only vars).
 */
export async function verifyAccessTokenEdge(
  token: string,
  rawSecret: string,
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(rawSecret));
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      sub: payload.sub,
      role: payload.role as UserRole,
      name: (payload.name as string) ?? "",
      onboardingCompleted: Boolean(payload.onboardingCompleted),
    };
  } catch {
    return null;
  }
}

import type { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./tokens";

/**
 * Auth cookies are httpOnly so no client script can read them, which rules out
 * token theft via XSS. `sameSite: lax` still sends them on top-level
 * navigation (needed for the middleware guards) while blocking cross-site POSTs.
 */
const baseOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

const ACCESS_MAX_AGE = 60 * 15; // 15 minutes
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function setAuthCookies(
  res: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
): NextResponse {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions,
    maxAge: ACCESS_MAX_AGE,
  });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions,
    maxAge: REFRESH_MAX_AGE,
  });
  return res;
}

export function clearAuthCookies(res: NextResponse): NextResponse {
  res.cookies.set(ACCESS_COOKIE, "", { ...baseOptions, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...baseOptions, maxAge: 0 });
  return res;
}

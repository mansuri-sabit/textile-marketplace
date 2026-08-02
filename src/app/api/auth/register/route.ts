import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { setAuthCookies } from "@/server/lib/cookies";
import { registerUser } from "@/server/services/auth.service";
import { registerSchema } from "@/server/validators/auth";

export const runtime = "nodejs";

export const POST = route(async (req: NextRequest) => {
  const input = registerSchema.parse(await req.json());
  const { user, tokens } = await registerUser(input);

  // Signed in immediately after registering — the next step is onboarding,
  // and bouncing a new user to a login screen first is pure friction.
  return setAuthCookies(ok({ user }, 201), tokens);
});

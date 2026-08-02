import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { setAuthCookies } from "@/server/lib/cookies";
import { loginUser } from "@/server/services/auth.service";
import { loginSchema } from "@/server/validators/auth";

export const runtime = "nodejs";

export const POST = route(async (req: NextRequest) => {
  const input = loginSchema.parse(await req.json());
  const { user, tokens } = await loginUser(input);
  return setAuthCookies(ok({ user }), tokens);
});

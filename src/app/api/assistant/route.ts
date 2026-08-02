import type { NextRequest } from "next/server";
import { ok, route } from "@/server/lib/api";
import { getSession } from "@/server/middleware/session";
import { askAssistant } from "@/server/services/assistant.service";
import { assistantSchema } from "@/server/validators/assistant";

export const runtime = "nodejs";

/**
 * POST /api/assistant
 *
 * Open to anonymous visitors on purpose — the assistant is the first thing a
 * buyer should be able to try. Personalisation is the only thing that needs a
 * session, and the buyer id is read from the cookie rather than the body, so a
 * caller cannot ask for someone else's preferences.
 */
export const POST = route(async (req: NextRequest) => {
  const input = assistantSchema.parse(await req.json());
  const session = await getSession();

  return ok(
    await askAssistant({
      ...input,
      buyerId: session?.role === "buyer" ? session.sub : undefined,
    }),
  );
});

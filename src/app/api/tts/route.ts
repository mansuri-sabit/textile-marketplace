import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { route } from "@/server/lib/api";
import { MAX_TTS_CHARS, synthesize } from "@/server/lib/tts";

export const runtime = "nodejs";

const schema = z.object({
  text: z.string().trim().min(1).max(MAX_TTS_CHARS),
});

/**
 * POST /api/tts — speak an assistant reply in the premium voice.
 *
 * Returns raw MPEG rather than the usual JSON envelope, so the browser can hand
 * it straight to an `<audio>` element. Any failure answers with the normal JSON
 * error and the client falls back to `speechSynthesis` — the fallback is the
 * feature, not an afterthought.
 *
 * Open to anonymous visitors because the assistant itself is; the character cap
 * in the schema is what bounds the spend.
 */
export const POST = route(async (req: NextRequest) => {
  const { text } = schema.parse(await req.json());
  const audio = await synthesize(text);

  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.byteLength),
      // Same reply, same audio — worth not re-billing for a replay.
      "Cache-Control": "private, max-age=3600",
    },
  });
});

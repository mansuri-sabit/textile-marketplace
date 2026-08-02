import { AppError } from "./api";
import { env, integrations } from "./env";

/**
 * Text to speech via ElevenLabs.
 *
 * This runs server-side for one non-negotiable reason: the API key must never
 * reach the browser. ElevenLabs bills per character, so a key in client code is
 * someone else's free TTS service.
 *
 * The browser's own `speechSynthesis` stays wired up as the fallback. It is the
 * difference between a demo that sounds good and a demo that goes silent when a
 * character quota runs out mid-presentation, so the client treats *any* failure
 * here — unconfigured, rate-limited, timed out — as "use the local voice".
 */

const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const TIMEOUT_MS = 15_000;

/** Assistant replies are 2-4 sentences; anything longer is a runaway bill. */
export const MAX_TTS_CHARS = 800;

export async function synthesize(text: string): Promise<ArrayBuffer> {
  if (!integrations.elevenLabs()) {
    throw new AppError(
      "TTS_UNAVAILABLE",
      "Premium voice is not configured on this deployment.",
      503,
    );
  }

  const e = env();
  const input = text.slice(0, MAX_TTS_CHARS);

  const res = await fetch(`${ENDPOINT}/${e.ELEVENLABS_VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": e.ELEVENLABS_API_KEY as string,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: input,
      model_id: e.ELEVENLABS_MODEL,
      voice_settings: {
        // Steady over expressive: this is a sourcing assistant reading
        // specifications, not narrating a story.
        stability: 0.5,
        similarity_boost: 0.75,
        speed: 1.05,
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    console.warn(`[tts] ElevenLabs ${res.status}: ${detail}`);

    // 401 is a bad key, 429 is the quota. Both mean the same thing to the
    // client — fall back to the browser voice — so they get one status.
    throw new AppError(
      "TTS_UNAVAILABLE",
      "Premium voice is unavailable right now.",
      503,
    );
  }

  return res.arrayBuffer();
}

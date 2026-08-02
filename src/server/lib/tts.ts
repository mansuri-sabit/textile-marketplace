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

/**
 * Voices a free-tier key can actually synthesise with.
 *
 * ElevenLabs splits its catalog into *default* voices and *library* voices, and
 * a free key gets 402 `paid_plan_required` on the latter — which is what broke
 * this the first time, with a voice ID that reads as a perfectly ordinary
 * default. The key here also lacks `voices_read`, so we cannot enumerate what
 * the account is entitled to; trying a short known-good chain is the reliable
 * substitute.
 */
const FALLBACK_VOICES = [
  "EXAVITQu4vr4xnSDxMaL", // Sarah
  "JBFqnCBsd6RMkjVDRZzb", // George
  "pNInz6obpgDQGcFmaJgB", // Adam
];

/** Remembered per isolate so we stop paying the 402 round trip on every reply. */
let workingVoice: string | null = null;

type Attempt = { ok: true; audio: ArrayBuffer } | { ok: false; status: number };

async function speakWith(voiceId: string, text: string): Promise<Attempt> {
  const e = env();

  const res = await fetch(`${ENDPOINT}/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": e.ELEVENLABS_API_KEY as string,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
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

  if (res.ok) return { ok: true, audio: await res.arrayBuffer() };

  console.warn(
    `[tts] ElevenLabs ${res.status} on voice ${voiceId}: ${(await res.text()).slice(0, 160)}`,
  );
  return { ok: false, status: res.status };
}

export async function synthesize(text: string): Promise<ArrayBuffer> {
  if (!integrations.elevenLabs()) {
    throw new AppError(
      "TTS_UNAVAILABLE",
      "Premium voice is not configured on this deployment.",
      503,
    );
  }

  const input = text.slice(0, MAX_TTS_CHARS);

  // Configured voice first, then the known-good chain. Deduped so an explicit
  // ELEVENLABS_VOICE_ID that already sits in the chain is not tried twice.
  const candidates = [
    ...new Set([workingVoice ?? env().ELEVENLABS_VOICE_ID, ...FALLBACK_VOICES]),
  ].filter(Boolean);

  for (const voiceId of candidates) {
    const attempt = await speakWith(voiceId, input);

    if (attempt.ok) {
      workingVoice = voiceId;
      return attempt.audio;
    }

    // 402 means "this voice needs a paid plan" — worth trying the next one.
    // Anything else (401 bad key, 429 quota, 5xx) will fail identically for
    // every voice, so stop and let the browser take over.
    if (attempt.status !== 402) break;
  }

  throw new AppError(
    "TTS_UNAVAILABLE",
    "Premium voice is unavailable right now.",
    503,
  );
}

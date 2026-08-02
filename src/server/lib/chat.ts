import { env, integrations } from "./env";

/**
 * Chat completions for the marketplace assistant.
 *
 * Hugging Face is primary because the brief asks for a custom HF model; its
 * router speaks the OpenAI wire format, so the OpenAI fallback is the same
 * function with a different base URL and key. The fallback exists for one
 * reason: the HF free tier has a monthly ceiling and a demo that dies because
 * the quota ran out is worse than one that quietly changes provider.
 *
 * Every call is bounded by a timeout. A hung completion must degrade to the
 * retrieval-only answer, never hold a request open until the platform kills it.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

const TIMEOUT_MS = 20_000;

export class ChatUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatUnavailableError";
  }
}

async function complete(
  url: string,
  token: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      // Low but not zero: sourcing answers should be steady and factual, while
      // still varying the phrasing enough not to read like a form letter.
      temperature: 0.3,
      top_p: 0.9,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("empty completion");
  return text;
}

/**
 * Returns the assistant's reply, or throws `ChatUnavailableError` when no
 * provider could answer. Callers are expected to catch that and fall back to
 * something useful rather than surfacing an error to the buyer.
 */
export async function chat(
  messages: ChatMessage[],
  opts: { maxTokens?: number } = {},
): Promise<{ text: string; provider: "huggingface" | "openai" }> {
  const e = env();
  const maxTokens = opts.maxTokens ?? 400;

  if (integrations.huggingFace()) {
    try {
      const text = await complete(
        HF_CHAT_URL,
        e.HF_TOKEN as string,
        e.HF_CHAT_MODEL,
        messages,
        maxTokens,
      );
      return { text, provider: "huggingface" };
    } catch (err) {
      console.warn(`[chat] Hugging Face failed: ${(err as Error).message}`);
      if (!integrations.openai()) {
        throw new ChatUnavailableError((err as Error).message);
      }
    }
  }

  if (!integrations.openai()) {
    throw new ChatUnavailableError("No chat provider configured");
  }

  try {
    const text = await complete(
      OPENAI_CHAT_URL,
      e.OPENAI_API_KEY as string,
      e.OPENAI_MODEL,
      messages,
      maxTokens,
    );
    return { text, provider: "openai" };
  } catch (err) {
    throw new ChatUnavailableError((err as Error).message);
  }
}

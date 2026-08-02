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
export type ChatProvider = "huggingface" | "openai";

/**
 * Tries the configured primary, then the other one. Which is primary is an env
 * switch (`AI_CHAT_PRIMARY`): OpenAI reaches first token faster, which shows on
 * a live demo, while Hugging Face is the open-source path the brief prefers.
 * Embeddings and semantic search are Hugging Face either way — the open-source
 * model does the retrieval that every answer is grounded in.
 */
export async function chat(
  messages: ChatMessage[],
  opts: { maxTokens?: number } = {},
): Promise<{ text: string; provider: ChatProvider }> {
  const e = env();
  const maxTokens = opts.maxTokens ?? 400;

  const providers: Record<
    ChatProvider,
    { available: boolean; url: string; key?: string; model: string }
  > = {
    openai: {
      available: integrations.openai(),
      url: OPENAI_CHAT_URL,
      key: e.OPENAI_API_KEY,
      model: e.OPENAI_MODEL,
    },
    huggingface: {
      available: integrations.huggingFace(),
      url: HF_CHAT_URL,
      key: e.HF_TOKEN,
      model: e.HF_CHAT_MODEL,
    },
  };

  const order: ChatProvider[] =
    e.AI_CHAT_PRIMARY === "openai"
      ? ["openai", "huggingface"]
      : ["huggingface", "openai"];

  let lastError = "No chat provider configured";

  for (const name of order) {
    const provider = providers[name];
    if (!provider.available) continue;

    try {
      const text = await complete(
        provider.url,
        provider.key as string,
        provider.model,
        messages,
        maxTokens,
      );
      return { text, provider: name };
    } catch (err) {
      lastError = (err as Error).message;
      console.warn(`[chat] ${name} failed: ${lastError}`);
    }
  }

  throw new ChatUnavailableError(lastError);
}

import { z } from "zod";

/**
 * Server-only environment contract.
 *
 * Required vars fail fast at first access so a misconfigured deploy breaks
 * loudly at startup instead of silently at request time. Optional integrations
 * (AI, uploads, cache) stay lazy so the core marketplace still runs without them.
 */
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB: z.string().min(1).default("textile_marketplace"),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be >= 32 chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be >= 32 chars"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),

  HF_TOKEN: z.string().optional(),
  HF_CHAT_MODEL: z.string().default("meta-llama/Llama-3.1-8B-Instruct"),
  HF_EMBEDDING_MODEL: z
    .string()
    .default("sentence-transformers/all-MiniLM-L6-v2"),
  HF_EMBEDDING_DIM: z.coerce.number().int().default(384),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  SARVAM_API_KEY: z.string().optional(),
  SARVAM_STT_MODEL: z.string().default("saarika:v2"),
  SARVAM_TTS_MODEL: z.string().default("bulbul:v2"),

  ELEVENLABS_API_KEY: z.string().optional(),
  /** "Rachel" — a clear, neutral default from the shared voice library. */
  ELEVENLABS_VOICE_ID: z.string().default("21m00Tcm4TlvDq8ikWAM"),
  ELEVENLABS_MODEL: z.string().default("eleven_turbo_v2_5"),

  PEXELS_API_KEY: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default("textile-marketplace"),

  REDIS_URL: z.string().optional(),
  REDIS_KEY_PREFIX: z.string().default("mkt:"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${details}\n\nCopy .env.example to .env.local and fill in the missing values.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** True when an optional integration has everything it needs. */
export const integrations = {
  huggingFace: () => Boolean(process.env.HF_TOKEN),
  openai: () => Boolean(process.env.OPENAI_API_KEY),
  sarvam: () => Boolean(process.env.SARVAM_API_KEY),
  elevenLabs: () => Boolean(process.env.ELEVENLABS_API_KEY),
  cloudinary: () =>
    Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET,
    ),
  redis: () => Boolean(process.env.REDIS_URL),
};

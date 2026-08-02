import { z } from "zod";

/**
 * The assistant is reachable without an account — a buyer evaluating the
 * marketplace should be able to ask before registering — so these limits are
 * the only thing standing between an open endpoint and someone using our
 * inference quota as their own. Keep them tight.
 */
export const assistantSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1, "Say something first").max(1000),
      }),
    )
    .min(1, "Say something first")
    .max(20),

  /** Product Q&A: anchors the answer to one fabric. */
  productSlug: z.string().trim().max(120).optional(),

  /** Explicit comparison set chosen in the UI. */
  compareSlugs: z.array(z.string().trim().max(120)).max(4).optional(),
});

export type AssistantInput = z.infer<typeof assistantSchema> & {
  /** Set server-side from the session; never accepted from the client. */
  buyerId?: string;
};

"use client";

import { create } from "zustand";

/**
 * Whether the assistant panel is open, and what it is anchored to.
 *
 * A store rather than props because the openers are scattered — the floating
 * launcher, the "Ask about this fabric" button on a product page, and any
 * future entry point — and none of them are near the panel in the tree.
 */
type AssistantState = {
  open: boolean;
  /** Set when opened from a product page, so answers are about that fabric. */
  productSlug?: string;
  /** A question to send immediately on open, from a suggestion chip. */
  seed?: string;
  openAssistant: (opts?: { productSlug?: string; seed?: string }) => void;
  close: () => void;
  /** Cleared once consumed so reopening does not re-ask the same question. */
  consumeSeed: () => void;
};

export const useAssistant = create<AssistantState>((set) => ({
  open: false,
  productSlug: undefined,
  seed: undefined,

  openAssistant: (opts) =>
    set({ open: true, productSlug: opts?.productSlug, seed: opts?.seed }),

  close: () => set({ open: false }),

  consumeSeed: () => set({ seed: undefined }),
}));

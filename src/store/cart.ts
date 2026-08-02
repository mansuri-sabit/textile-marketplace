"use client";

import { create } from "zustand";
import { api } from "@/lib/api-client";
import type { CartState } from "@/types";

const EMPTY: CartState = {
  items: [],
  groups: [],
  itemCount: 0,
  lineCount: 0,
  subtotal: 0,
  shippingFee: 0,
  taxAmount: 0,
  total: 0,
  hasIssues: false,
};

type Store = {
  cart: CartState;
  loading: boolean;
  /** True while a mutation is in flight, so buttons can disable individually. */
  pending: string | null;
  load: () => Promise<void>;
  add: (productId: string, quantity: number, color?: string) => Promise<void>;
  update: (productId: string, quantity: number, color?: string) => Promise<void>;
  remove: (productId: string, color?: string) => Promise<void>;
  clear: () => Promise<void>;
  reset: () => void;
};

/**
 * The server is the single source of truth for the cart — every mutation
 * returns the recomputed cart and replaces local state wholesale. Tempting as
 * optimistic updates are, bulk pricing and MOQ rules mean the client cannot
 * predict the resulting totals without duplicating the pricing logic.
 */
export const useCart = create<Store>((set) => ({
  cart: EMPTY,
  loading: false,
  pending: null,

  load: async () => {
    set({ loading: true });
    try {
      set({ cart: await api.get<CartState>("/api/cart"), loading: false });
    } catch {
      set({ cart: EMPTY, loading: false });
    }
  },

  add: async (productId, quantity, color) => {
    set({ pending: productId });
    try {
      set({ cart: await api.post<CartState>("/api/cart", { productId, quantity, color }) });
    } finally {
      set({ pending: null });
    }
  },

  update: async (productId, quantity, color) => {
    set({ pending: productId });
    try {
      set({
        cart: await api.patch<CartState>(`/api/cart/items/${productId}`, { quantity, color }),
      });
    } finally {
      set({ pending: null });
    }
  },

  remove: async (productId, color) => {
    set({ pending: productId });
    try {
      const suffix = color ? `?color=${encodeURIComponent(color)}` : "";
      set({ cart: await api.delete<CartState>(`/api/cart/items/${productId}${suffix}`) });
    } finally {
      set({ pending: null });
    }
  },

  clear: async () => {
    set({ cart: await api.delete<CartState>("/api/cart") });
  },

  reset: () => set({ cart: EMPTY }),
}));

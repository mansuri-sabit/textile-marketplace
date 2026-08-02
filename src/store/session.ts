"use client";

import { create } from "zustand";
import { api, ApiError } from "@/lib/api-client";
import type { SessionUser } from "@/types";

type SessionState = {
  user: SessionUser | null;
  status: "idle" | "loading" | "ready";
  load: () => Promise<void>;
  setUser: (user: SessionUser | null) => void;
  logout: () => Promise<void>;
};

/**
 * Client-side view of the session.
 *
 * This is convenience state for rendering, not an authorisation boundary —
 * every protected route and API call re-checks the httpOnly cookie server-side.
 */
export const useSession = create<SessionState>((set) => ({
  user: null,
  status: "idle",

  load: async () => {
    set({ status: "loading" });
    try {
      const data = await api.get<{ user: SessionUser | null }>("/api/auth/me");
      set({ user: data.user, status: "ready" });
    } catch {
      // A failed session read means "signed out", not a page-level error.
      set({ user: null, status: "ready" });
    }
  },

  setUser: (user) => set({ user, status: "ready" }),

  logout: async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
    set({ user: null, status: "ready" });
  },
}));

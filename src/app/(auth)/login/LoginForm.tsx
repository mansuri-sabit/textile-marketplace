"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { useCart } from "@/store/cart";
import { useSession } from "@/store/session";
import type { SessionUser } from "@/types";

const DEMO_ACCOUNTS = [
  { label: "Demo buyer", email: "buyer@demo.test", password: "Buyer123" },
  { label: "Demo supplier", email: "supplier.meridian@demo.test", password: "Supplier123" },
];

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setUser = useSession((s) => s.setUser);
  const loadCart = useCart((s) => s.load);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function signIn(withEmail = email, withPassword = password) {
    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const { user } = await api.post<{ user: SessionUser }>("/api/auth/login", {
        email: withEmail,
        password: withPassword,
      });
      setUser(user);
      if (user.role === "buyer") void loadCart();

      // Honour the destination the route guard preserved, but never send a
      // user into the other role's area.
      const next = params.get("next");
      const fallback = user.role === "supplier" ? "/supplier" : "/";
      const destination = !user.onboardingCompleted
        ? user.role === "supplier"
          ? "/supplier/onboarding"
          : "/onboarding"
        : next && next.startsWith("/")
          ? next
          : fallback;

      router.push(destination);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("Could not sign in. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Welcome back</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Sign in to your buyer or supplier account.
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn();
        }}
      >
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-500"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          placeholder="you@company.com"
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          placeholder="••••••••"
        />

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>

      <div className="mt-6 rounded-card border border-dashed border-line p-3.5">
        <p className="text-xs font-medium text-ink-muted">Try it without signing up</p>
        <div className="mt-2.5 grid gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              disabled={loading}
              onClick={() => {
                setEmail(account.email);
                setPassword(account.password);
                void signIn(account.email, account.password);
              }}
              className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs transition-colors hover:border-indigo-200 disabled:opacity-50"
            >
              <span className="font-medium text-ink">{account.label}</span>
              <span className="text-ink-subtle">{account.email}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Don&rsquo;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-indigo-600 underline-offset-2 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

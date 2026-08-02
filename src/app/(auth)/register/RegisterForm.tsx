"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ShoppingBag, Store, TriangleAlert } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { useSession } from "@/store/session";
import type { SessionUser, UserRole } from "@/types";

const ROLES: Array<{
  value: UserRole;
  title: string;
  body: string;
  icon: React.ReactNode;
}> = [
  {
    value: "buyer",
    title: "I'm buying",
    body: "Source fabric for a brand, factory or boutique",
    icon: <ShoppingBag className="size-5" />,
  },
  {
    value: "supplier",
    title: "I'm selling",
    body: "List your mill or collective and take orders",
    icon: <Store className="size-5" />,
  },
];

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setUser = useSession((s) => s.setUser);

  const initialRole = params.get("role") === "supplier" ? "supplier" : "buyer";
  const [role, setRole] = useState<UserRole>(initialRole);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const { user } = await api.post<{ user: SessionUser }>("/api/auth/register", {
        ...form,
        phone: form.phone || undefined,
        role,
      });
      setUser(user);
      // Registration signs the user in, so the next stop is onboarding rather
      // than a login screen they would immediately pass through.
      router.push(role === "supplier" ? "/supplier/onboarding" : "/onboarding");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("Could not create your account. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Create your account</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Takes a minute. You can finish setting up your profile right after.
      </p>

      <div className="mt-7 grid gap-2.5">
        {ROLES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setRole(option.value)}
            aria-pressed={role === option.value}
            className={cn(
              "flex items-start gap-3 rounded-card border p-3.5 text-left transition-colors",
              role === option.value
                ? "border-indigo-400 bg-indigo-50"
                : "border-line bg-surface hover:border-line-strong",
            )}
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-lg",
                role === option.value
                  ? "bg-indigo-600 text-white dark:bg-indigo-500"
                  : "bg-raised text-ink-muted",
              )}
            >
              {option.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{option.title}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{option.body}</span>
            </span>
            {role === option.value && (
              <Check className="size-4 shrink-0 self-center text-indigo-600" />
            )}
          </button>
        ))}
      </div>

      <form className="mt-6 space-y-4" onSubmit={submit}>
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
          label="Full name"
          required
          autoComplete="name"
          value={form.name}
          onChange={set("name")}
          error={fieldErrors.name}
          placeholder="Priya Menon"
        />

        <Input
          label="Work email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={set("email")}
          error={fieldErrors.email}
          placeholder="you@company.com"
        />

        <Input
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={set("phone")}
          error={fieldErrors.phone}
          placeholder="+91 98450 00000"
          hint="Optional — suppliers use this to confirm large orders"
        />

        <Input
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
          error={fieldErrors.password}
          placeholder="At least 8 characters"
          hint="Minimum 8 characters, with a letter and a number"
        />

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-indigo-600 underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, TriangleAlert, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { useSession } from "@/store/session";
import type { SessionUser } from "@/types";

/**
 * Inline editing of the buyer's own account.
 *
 * Read view by default — a profile page is read far more often than it is
 * edited, and a page of live inputs invites accidental changes.
 */
export function AccountForm({
  name,
  phone,
  email,
}: {
  name: string;
  phone: string;
  email: string;
}) {
  const router = useRouter();
  const setUser = useSession((s) => s.setUser);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name, phone });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFailure(null);
    setErrors({});

    try {
      const { user } = await api.patch<{ user: SessionUser }>("/api/auth/me", {
        name: form.name.trim(),
        phone: form.phone.trim(),
      });
      // The header shows the name, so the store has to hear about this.
      setUser(user);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setFailure(err.message);
        setErrors(err.fieldErrors);
      } else {
        setFailure("Could not save your details.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" />
          Edit details
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-moss-600">
            <Check className="size-3.5" />
            Saved
          </span>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 border-t border-line pt-5">
      {failure && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-500"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {failure}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Full name"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          error={errors.name}
          autoComplete="name"
        />
        <Input
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          error={errors.phone}
          autoComplete="tel"
          hint="Suppliers use this to confirm large orders"
        />
      </div>

      <Input
        label="Email"
        value={email}
        disabled
        hint="Your sign-in address cannot be changed in this prototype"
      />

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={saving}>
          <Check className="size-4" />
          Save details
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setForm({ name, phone });
            setErrors({});
            setFailure(null);
            setEditing(false);
          }}
          disabled={saving}
        >
          <X className="size-4" />
          Cancel
        </Button>
      </div>
    </form>
  );
}

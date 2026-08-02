"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Ban, Check, TriangleAlert } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
} from "@/server/constants/marketplace";
import type { OrderStatus } from "@/types";

/**
 * Advances an order along `ORDER_STATUS_FLOW`.
 *
 * The buttons are derived from the flow rather than hardcoded, so the UI can
 * never offer a transition the server would reject — and adding a stage to the
 * flow constant makes it appear here with no change to this file. Cancelling is
 * separated out and asks for confirmation: it returns stock to the catalog and
 * cannot be undone.
 */
export function OrderStatusControl({
  orderNumber,
  status,
}: {
  orderNumber: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [note, setNote] = useState("");

  const next = ORDER_STATUS_FLOW[status] ?? [];
  const forward = next.filter((s) => s !== "cancelled");
  const canCancel = next.includes("cancelled");

  async function move(to: OrderStatus) {
    setPending(to);
    setError(null);
    try {
      await api.patch(`/api/supplier/orders/${orderNumber}`, {
        status: to,
        note: note.trim() || undefined,
      });
      setNote("");
      setConfirmingCancel(false);
      // The page is a Server Component reading the order — refresh re-renders
      // it with the new status and history rather than duplicating that state.
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update this order.",
      );
    } finally {
      setPending(null);
    }
  }

  if (next.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-raised px-4 py-3 text-sm text-ink-muted">
        This order is {ORDER_STATUS_LABELS[status].toLowerCase()}. No further
        changes are possible.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-500"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <Textarea
        label="Note for the buyer"
        hint="Optional — attached to this status change and shown on their tracking page"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Dispatching Tuesday via Gati, docket to follow."
      />

      <div className="flex flex-wrap gap-2">
        {forward.map((to) => (
          <Button
            key={to}
            onClick={() => move(to)}
            loading={pending === to}
            disabled={pending !== null}
          >
            {to === "completed" ? (
              <Check className="size-4" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            Mark {ORDER_STATUS_LABELS[to].toLowerCase()}
          </Button>
        ))}
      </div>

      {canCancel &&
        (confirmingCancel ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-50 p-4">
            <p className="text-sm font-medium text-rose-500">
              Cancel this order?
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              The reserved stock goes back to your catalog and the buyer is told
              immediately. This cannot be undone.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => move("cancelled")}
                loading={pending === "cancelled"}
              >
                Yes, cancel it
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingCancel(false)}
                disabled={pending !== null}
              >
                Keep the order
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            disabled={pending !== null}
            className="inline-flex items-center gap-1.5 text-sm text-ink-subtle underline-offset-2 hover:text-rose-500 hover:underline disabled:opacity-50"
          >
            <Ban className="size-3.5" />
            Cancel this order
          </button>
        ))}
    </div>
  );
}

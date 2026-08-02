import { Check, CircleDashed, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ORDER_STATUS_LABELS } from "@/server/constants/marketplace";
import type { OrderStatus } from "@/types";

/**
 * Shared order-status presentation. Kept in one place so the confirmation
 * screen, the orders list and the order detail page can never label the same
 * status differently — the wording is the buyer's only signal about what is
 * happening to their money.
 */

const TONES: Record<OrderStatus, React.ComponentProps<typeof Badge>["tone"]> = {
  pending: "amber",
  accepted: "indigo",
  preparing: "indigo",
  ready_for_dispatch: "clay",
  completed: "moss",
  cancelled: "rose",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={TONES[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

/** The happy path, in order. `cancelled` is off this track by design. */
const TRACK: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready_for_dispatch",
  "completed",
];

const BLURB: Record<OrderStatus, string> = {
  pending: "Sent to the supplier, waiting for them to confirm",
  accepted: "Supplier has confirmed the order",
  preparing: "Fabric is being cut and packed",
  ready_for_dispatch: "Packed and waiting on freight",
  completed: "Handed over — this order is closed",
  cancelled: "This order was cancelled and any stock returned",
};

export function OrderTimeline({
  status,
  history,
  className,
}: {
  status: OrderStatus;
  history: Array<{ status: OrderStatus; at: string; note?: string }>;
  className?: string;
}) {
  const seen = new Map(history.map((h) => [h.status, h]));

  if (status === "cancelled") {
    const event = seen.get("cancelled");
    return (
      <div className={cn("flex items-start gap-3", className)}>
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-500">
          <X className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-ink">Cancelled</p>
          <p className="mt-0.5 text-xs text-ink-muted">{BLURB.cancelled}</p>
          {event?.note && (
            <p className="mt-1 text-xs italic text-ink-subtle">“{event.note}”</p>
          )}
        </div>
      </div>
    );
  }

  const current = TRACK.indexOf(status);

  return (
    <ol className={cn("space-y-0", className)}>
      {TRACK.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const event = seen.get(step);

        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border",
                  done && "border-moss-500 bg-moss-500 text-white",
                  active && "border-indigo-500 bg-indigo-500 text-white",
                  !done && !active && "border-line text-ink-subtle",
                )}
              >
                {done ? (
                  <Check className="size-3.5" />
                ) : active ? (
                  <span className="size-2 rounded-full bg-current" />
                ) : (
                  <CircleDashed className="size-3.5" />
                )}
              </span>
              {i < TRACK.length - 1 && (
                <span
                  className={cn(
                    "w-px flex-1",
                    done ? "bg-moss-500" : "bg-line",
                  )}
                  aria-hidden
                />
              )}
            </div>

            <div className={cn("pb-5", i === TRACK.length - 1 && "pb-0")}>
              <p
                className={cn(
                  "text-sm",
                  active || done ? "font-medium text-ink" : "text-ink-subtle",
                )}
              >
                {ORDER_STATUS_LABELS[step]}
              </p>
              {(active || done) && (
                <p className="mt-0.5 text-xs text-ink-muted">{BLURB[step]}</p>
              )}
              {event && (
                <time
                  className="mt-0.5 block text-xs text-ink-subtle tnum"
                  dateTime={event.at}
                >
                  {new Date(event.at).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              )}
              {event?.note && (
                <p className="mt-1 text-xs italic text-ink-subtle">“{event.note}”</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

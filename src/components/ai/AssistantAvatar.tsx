import { cn } from "@/lib/cn";

/**
 * Meera, the sourcing assistant.
 *
 * Drawn rather than photographed, on purpose. A stock portrait would put a real
 * person's face on an AI that speaks for the marketplace, and a remote image
 * would be one more request between the buyer and an answer. This is inline
 * SVG: no fetch, no layout shift, crisp at 28px in the header and at 56px on
 * the launcher.
 */
export function AssistantAvatar({
  className,
  ring,
}: {
  className?: string;
  /** Soft outer ring, for placement against the indigo header. */
  ring?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-block shrink-0 overflow-hidden rounded-full",
        ring && "ring-2 ring-white/25",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" className="size-full">
        <defs>
          <clipPath id="assistant-avatar-clip">
            <circle cx="32" cy="32" r="32" />
          </clipPath>
        </defs>

        <g clipPath="url(#assistant-avatar-clip)">
          <rect width="64" height="64" fill="#dbe1f0" />

          {/* Shoulders — the indigo of the marketplace, so she reads as staff. */}
          <path d="M8 64c0-11.6 10.7-18 24-18s24 6.4 24 18z" fill="#32457c" />
          <path d="M26 47c2 4 10 4 12 0l-2-5H28z" fill="#e8b89b" />

          {/* Hair behind the face, then the face, then the fringe over it. */}
          <path
            d="M17 31c0-11 6.7-18 15-18s15 7 15 18c0 4-1 8-1 11l3 6-6 2H21l-6-2 3-6c0-3-1-7-1-11z"
            fill="#241b17"
          />
          <ellipse cx="32" cy="31" rx="12" ry="14" fill="#f0c4a5" />
          <path
            d="M20 28c0-9 5.4-15 12-15s12 6 12 15c0-4-4-6-12-6s-12 2-12 6z"
            fill="#2f231d"
          />

          {/* Features kept to the minimum that still reads at 28px. */}
          <ellipse cx="27" cy="31" rx="1.5" ry="1.9" fill="#241b17" />
          <ellipse cx="37" cy="31" rx="1.5" ry="1.9" fill="#241b17" />
          <path
            d="M28.5 37.5c1.8 1.6 5.2 1.6 7 0"
            stroke="#b9755a"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </svg>
    </span>
  );
}

/** Name and role, kept in one place so the panel and the launcher agree. */
export const ASSISTANT_NAME = "Meera";
export const ASSISTANT_ROLE = "Sourcing assistant";

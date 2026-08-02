"use client";

import { MessageCircleQuestion, Sparkles } from "lucide-react";
import { useAssistant } from "@/store/assistant";

/**
 * Product Q&A entry point.
 *
 * Opening the assistant with this product's slug switches the server to
 * product-anchored retrieval: the fabric itself plus its nearest alternatives,
 * so "is there anything lighter?" has real rows to answer from.
 */
export function AskAboutProduct({
  slug,
  questions,
}: {
  slug: string;
  /** Starter questions, asked immediately rather than typed. */
  questions?: string[];
}) {
  const openAssistant = useAssistant((s) => s.openAssistant);

  const starters = questions ?? [
    "What is this fabric best used for?",
    "How does it wash and shrink?",
    "Show me something lighter",
  ];

  return (
    <div className="rounded-card border border-line bg-raised p-4">
      <button
        type="button"
        onClick={() => openAssistant({ productSlug: slug })}
        className="flex w-full items-center gap-2.5 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-600 text-white dark:bg-indigo-500">
          <Sparkles className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">
            Ask about this fabric
          </span>
          <span className="block text-xs text-ink-muted">
            Answers come from this listing&rsquo;s own spec sheet
          </span>
        </span>
        <MessageCircleQuestion className="size-4 shrink-0 text-ink-subtle" />
      </button>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {starters.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => openAssistant({ productSlug: slug, seed: question })}
            className="rounded-full border border-line bg-surface px-2.5 py-1.5 text-[11px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}

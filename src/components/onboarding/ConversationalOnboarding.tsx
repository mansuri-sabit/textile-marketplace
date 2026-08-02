"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Pencil,
  Send,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * A guided chat that collects a structured answer set.
 *
 * The brief asks for onboarding that feels conversational rather than a wall of
 * form fields. This is deliberately a scripted assistant, not a model call: it
 * is instant, works offline, cannot hallucinate an enum value the database
 * would reject, and costs nothing on demo day. The transcript shape means the
 * same screen can be handed to the LLM assistant later without the buyer
 * noticing a change in interaction model.
 */

export type FormField = {
  name: string;
  label: string;
  placeholder?: string;
  optional?: boolean;
  inputMode?: "text" | "tel" | "email" | "numeric";
  autoComplete?: string;
  /** Half-width on desktop, so city/state/PIN sit on one line. */
  half?: boolean;
  validate?: (value: string) => string | null;
};

export type OnboardingStep =
  | {
      id: string;
      kind: "single";
      prompt: string;
      /** Short noun for the review table; the prompt is a full question. */
      label: string;
      help?: string;
      options: readonly string[];
    }
  | {
      id: string;
      kind: "multi";
      prompt: string;
      label: string;
      help?: string;
      options: readonly string[];
      min?: number;
      max?: number;
    }
  | {
      id: string;
      kind: "text";
      prompt: string;
      label: string;
      help?: string;
      placeholder?: string;
      optional?: boolean;
      multiline?: boolean;
      inputMode?: "text" | "tel" | "email" | "numeric";
      validate?: (value: string) => string | null;
    }
  | {
      id: string;
      kind: "form";
      prompt: string;
      label: string;
      help?: string;
      fields: FormField[];
    };

export type StepAnswer = string | string[] | Record<string, string>;
export type OnboardingAnswers = Record<string, StepAnswer>;

function summarise(step: OnboardingStep, answer: StepAnswer | undefined): string {
  if (answer === undefined) return "";
  if (Array.isArray(answer)) return answer.length ? answer.join(" · ") : "No preference";
  if (typeof answer === "object") {
    return Object.values(answer).filter(Boolean).join(", ");
  }
  return answer.trim() || (step.kind === "text" && step.optional ? "Skipped" : "");
}

export function ConversationalOnboarding({
  greeting,
  steps,
  initial,
  reviewTitle = "Here's what I've got",
  finishLabel = "Looks right — finish",
  onSubmit,
}: {
  /** Opening assistant lines, shown before the first question. */
  greeting: string[];
  steps: OnboardingStep[];
  initial?: OnboardingAnswers;
  reviewTitle?: string;
  finishLabel?: string;
  onSubmit: (answers: OnboardingAnswers) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<OnboardingAnswers>(initial ?? {});
  const [index, setIndex] = useState(0);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const liveRef = useRef<HTMLDivElement>(null);
  const reviewing = index >= steps.length;
  const current = reviewing ? null : steps[index];

  // Keep the active question in view as the transcript grows past the fold.
  useEffect(() => {
    liveRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [index, typing]);

  function advance(id: string, value: StepAnswer) {
    setAnswers((a) => ({ ...a, [id]: value }));
    setError(null);
    // A beat of "typing" before the next question — without it the whole script
    // lands at once and stops reading as a conversation.
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setIndex((i) => i + 1);
    }, 320);
  }

  async function finish() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(answers);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not save your answers.",
      );
      setSubmitting(false);
    }
  }

  const answered = Math.min(index, steps.length);
  const progress = Math.round((answered / steps.length) * 100);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="sticky top-16 z-10 -mx-4 mb-8 bg-paper/90 px-4 pb-4 pt-2 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between text-xs text-ink-subtle">
          <span className="inline-flex items-center gap-1.5 font-medium text-indigo-500">
            <Sparkles className="size-3.5" />
            Setup assistant
          </span>
          <span className="tnum">
            {answered} of {steps.length}
          </span>
        </div>
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Onboarding progress"
        >
          <div
            className="h-full rounded-full bg-indigo-500 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-5">
        {greeting.map((line, i) => (
          <Bubble key={i}>{line}</Bubble>
        ))}

        {steps.slice(0, answered).map((step, i) => (
          <div key={step.id} className="space-y-2.5">
            <Bubble>{step.prompt}</Bubble>
            <Reply
              onEdit={() => {
                setIndex(i);
                setError(null);
              }}
            >
              {summarise(step, answers[step.id])}
            </Reply>
          </div>
        ))}

        <div ref={liveRef} className="scroll-mt-32">
          {typing && <TypingDots />}

          {!typing && current && (
            <div className="space-y-4">
              <Bubble>{current.prompt}</Bubble>
              {current.help && (
                <p className="pl-11 text-xs text-ink-subtle">{current.help}</p>
              )}

              {error && (
                <p
                  role="alert"
                  className="ml-11 flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs font-medium text-rose-500"
                >
                  <TriangleAlert className="mt-px size-3.5 shrink-0" />
                  {error}
                </p>
              )}

              <div className="pl-11">
                <Composer
                  key={current.id}
                  step={current}
                  value={answers[current.id]}
                  onError={setError}
                  onAnswer={(value) => advance(current.id, value)}
                />
              </div>
            </div>
          )}

          {!typing && reviewing && (
            <div className="space-y-4">
              <Bubble>{reviewTitle}</Bubble>

              <div className="ml-11 overflow-hidden rounded-card border border-line bg-surface">
                <dl className="divide-y divide-line">
                  {steps.map((step, i) => (
                    <div
                      key={step.id}
                      className="flex items-start gap-3 px-4 py-3 text-sm"
                    >
                      <dt className="w-32 shrink-0 text-xs text-ink-subtle">
                        {step.label}
                      </dt>
                      <dd className="min-w-0 flex-1 text-ink">
                        {summarise(step, answers[step.id]) || "—"}
                      </dd>
                      <button
                        type="button"
                        onClick={() => setIndex(i)}
                        className="shrink-0 rounded-lg p-1 text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
                        aria-label={`Change: ${step.prompt}`}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </dl>
              </div>

              {submitError && (
                <p
                  role="alert"
                  className="ml-11 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-500"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  {submitError}
                </p>
              )}

              <div className="ml-11">
                <Button size="lg" onClick={finish} loading={submitting}>
                  <Check className="size-[18px]" />
                  {finishLabel}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-600 text-white dark:bg-indigo-500">
        <Sparkles className="size-4" />
      </span>
      <p className="max-w-lg rounded-2xl rounded-tl-sm border border-line bg-surface px-4 py-2.5 text-sm leading-relaxed text-ink">
        {children}
      </p>
    </div>
  );
}

function Reply({
  children,
  onEdit,
}: {
  children: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg p-1.5 text-ink-subtle opacity-0 transition-opacity hover:bg-raised hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-100"
        aria-label="Change this answer"
      >
        <Pencil className="size-3.5" />
      </button>
      <p className="max-w-lg rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white dark:bg-indigo-500 dark:text-indigo-50">
        {children}
      </p>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-600 text-white dark:bg-indigo-500">
        <Sparkles className="size-4" />
      </span>
      <span className="flex gap-1 rounded-2xl rounded-tl-sm border border-line bg-surface px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full bg-ink-subtle"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </span>
    </div>
  );
}

function Composer({
  step,
  value,
  onAnswer,
  onError,
}: {
  step: OnboardingStep;
  value: StepAnswer | undefined;
  onAnswer: (value: StepAnswer) => void;
  onError: (message: string | null) => void;
}) {
  if (step.kind === "single") {
    return (
      <div className="flex flex-wrap gap-2">
        {step.options.map((option) => (
          <Chip
            key={option}
            selected={value === option}
            onClick={() => onAnswer(option)}
          >
            {option}
          </Chip>
        ))}
      </div>
    );
  }

  if (step.kind === "multi") return <MultiComposer step={step} value={value} onAnswer={onAnswer} onError={onError} />;
  if (step.kind === "text") return <TextComposer step={step} value={value} onAnswer={onAnswer} onError={onError} />;
  return <FormComposer step={step} value={value} onAnswer={onAnswer} onError={onError} />;
}

type ComposerProps<S> = {
  step: S;
  value: StepAnswer | undefined;
  onAnswer: (value: StepAnswer) => void;
  onError: (message: string | null) => void;
};

function MultiComposer({
  step,
  value,
  onAnswer,
  onError,
}: ComposerProps<Extract<OnboardingStep, { kind: "multi" }>>) {
  const [picked, setPicked] = useState<string[]>(
    Array.isArray(value) ? value : [],
  );
  const min = step.min ?? 0;
  const max = step.max ?? step.options.length;

  function toggle(option: string) {
    onError(null);
    setPicked((p) =>
      p.includes(option)
        ? p.filter((o) => o !== option)
        : p.length >= max
          ? p
          : [...p, option],
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {step.options.map((option) => (
          <Chip
            key={option}
            selected={picked.includes(option)}
            onClick={() => toggle(option)}
          >
            {picked.includes(option) && <Check className="size-3.5" />}
            {option}
          </Chip>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => {
            if (picked.length < min) {
              onError(
                min === 1
                  ? "Pick at least one to continue."
                  : `Pick at least ${min} to continue.`,
              );
              return;
            }
            onAnswer(picked);
          }}
        >
          Continue
          <ArrowRight className="size-4" />
        </Button>
        {min === 0 && (
          <button
            type="button"
            onClick={() => onAnswer([])}
            className="text-sm text-ink-subtle underline-offset-2 hover:text-ink hover:underline"
          >
            No preference
          </button>
        )}
        {picked.length > 0 && (
          <span className="text-xs text-ink-subtle tnum">
            {picked.length} selected
          </span>
        )}
      </div>
    </div>
  );
}

function TextComposer({
  step,
  value,
  onAnswer,
  onError,
}: ComposerProps<Extract<OnboardingStep, { kind: "text" }>>) {
  const [text, setText] = useState(typeof value === "string" ? value : "");

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = text.trim();

    if (!trimmed && !step.optional) {
      onError("This one is needed to continue.");
      return;
    }
    const problem = trimmed ? (step.validate?.(trimmed) ?? null) : null;
    if (problem) {
      onError(problem);
      return;
    }
    onAnswer(trimmed);
  }

  function change(value: string) {
    setText(value);
    onError(null);
  }

  const control =
    "w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-ink-subtle " +
    "focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-end gap-2">
        {step.multiline ? (
          <textarea
            value={text}
            onChange={(e) => change(e.target.value)}
            // Enter inserts a newline here, so offer the usual shortcut to send.
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder={step.placeholder}
            rows={3}
            autoFocus
            aria-label={step.prompt}
            className={cn(control, "resize-y py-3")}
          />
        ) : (
          <input
            value={text}
            onChange={(e) => change(e.target.value)}
            placeholder={step.placeholder}
            inputMode={step.inputMode}
            autoFocus
            aria-label={step.prompt}
            className={cn(control, "h-11")}
          />
        )}
        <Button
          type="submit"
          size="icon"
          className="size-11 shrink-0 rounded-2xl"
          aria-label="Send"
        >
          <Send className="size-4" />
        </Button>
      </div>

      {step.optional && (
        <button
          type="button"
          onClick={() => onAnswer("")}
          className="text-sm text-ink-subtle underline-offset-2 hover:text-ink hover:underline"
        >
          Skip this
        </button>
      )}
    </form>
  );
}

function FormComposer({
  step,
  value,
  onAnswer,
  onError,
}: ComposerProps<Extract<OnboardingStep, { kind: "form" }>>) {
  const initial = useMemo(
    () =>
      Object.fromEntries(
        step.fields.map((f) => [
          f.name,
          (value && typeof value === "object" && !Array.isArray(value)
            ? value[f.name]
            : "") ?? "",
        ]),
      ),
    [step.fields, value],
  );

  const [form, setForm] = useState<Record<string, string>>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problems: Record<string, string> = {};

    for (const field of step.fields) {
      const raw = (form[field.name] ?? "").trim();
      if (!raw) {
        if (!field.optional) problems[field.name] = "Required";
        continue;
      }
      const problem = field.validate?.(raw);
      if (problem) problems[field.name] = problem;
    }

    setFieldErrors(problems);
    if (Object.keys(problems).length) {
      onError("Please check the highlighted fields.");
      return;
    }

    onError(null);
    onAnswer(
      Object.fromEntries(
        step.fields.map((f) => [f.name, (form[f.name] ?? "").trim()]),
      ),
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-card border border-line bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {step.fields.map((field) => (
          <label
            key={field.name}
            className={cn("block space-y-1.5", !field.half && "sm:col-span-2")}
          >
            <span className="text-xs font-medium text-ink-muted">
              {field.label}
              {field.optional && (
                <span className="ml-1 font-normal text-ink-subtle">optional</span>
              )}
            </span>
            <input
              value={form[field.name] ?? ""}
              onChange={(e) => {
                setForm((f) => ({ ...f, [field.name]: e.target.value }));
                setFieldErrors((f) => ({ ...f, [field.name]: "" }));
                onError(null);
              }}
              placeholder={field.placeholder}
              inputMode={field.inputMode}
              autoComplete={field.autoComplete}
              aria-invalid={fieldErrors[field.name] ? true : undefined}
              className={cn(
                "h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle",
                "focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
                fieldErrors[field.name] ? "border-rose-500" : "border-line",
              )}
            />
            {fieldErrors[field.name] && (
              <span className="block text-xs font-medium text-rose-500">
                {fieldErrors[field.name]}
              </span>
            )}
          </label>
        ))}
      </div>

      <Button type="submit">
        Continue
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors",
        selected
          ? "border-indigo-400 bg-indigo-50 font-medium text-indigo-600"
          : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

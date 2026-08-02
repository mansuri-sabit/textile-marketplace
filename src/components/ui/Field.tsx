"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle " +
  "transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 " +
  "disabled:opacity-60 disabled:bg-raised";

type FieldShellProps = {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (id: string, describedBy?: string) => React.ReactNode;
  className?: string;
};

/**
 * Wraps a control with its label, hint and error, wiring up the aria
 * relationships so screen readers announce the error with the field rather
 * than as loose text somewhere on the page.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children(id, describedBy)}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-rose-500">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  inputClassName?: string;
};

export function Input({
  label,
  hint,
  error,
  className,
  inputClassName,
  required,
  ...props
}: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(id, describedBy) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          className={cn(
            CONTROL,
            "h-10",
            error ? "border-rose-500" : "border-line",
            inputClassName,
          )}
          {...props}
        />
      )}
    </Field>
  );
}

type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
};

export function Textarea({
  label,
  hint,
  error,
  className,
  required,
  rows = 4,
  ...props
}: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(id, describedBy) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          className={cn(CONTROL, "py-2 resize-y", error ? "border-rose-500" : "border-line")}
          {...props}
        />
      )}
    </Field>
  );
}

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export function Select({
  label,
  hint,
  error,
  className,
  options,
  placeholder,
  required,
  ...props
}: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(id, describedBy) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          className={cn(CONTROL, "h-10 pr-8", error ? "border-rose-500" : "border-line")}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

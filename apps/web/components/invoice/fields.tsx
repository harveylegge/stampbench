'use client';

import { useId } from 'react';

/**
 * Form primitives for the invoice builder.
 *
 * Every control here is label-first and id-linked rather than placeholder-only:
 * a placeholder disappears the moment someone types, which on a form with
 * forty fields and a compliance verdict at the end is exactly when they need
 * to know what they are looking at. Hints get an id and are referenced by
 * aria-describedby so a screen reader reads the constraint with the field,
 * and required/invalid states carry text as well as colour.
 */

const INPUT =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition placeholder:text-faint focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-faint';

export function Field({
  label,
  hint,
  required,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: (props: { id: string; describedBy?: string }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-text">
        {label}
        {required && (
          <span className="ml-1 text-xs font-normal text-faint">
            required<span className="sr-only"> field</span>
          </span>
        )}
      </label>
      {children({ id, describedBy: hintId })}
      {hint && (
        <p id={hintId} className="mt-1 text-xs leading-relaxed text-faint">
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  required,
  type = 'text',
  className = '',
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  className?: string;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'email' | 'tel';
  autoComplete?: string;
}) {
  return (
    <Field label={label} hint={hint} required={required} className={className}>
      {({ id, describedBy }) => (
        <input
          id={id}
          type={type}
          value={value}
          inputMode={inputMode}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={INPUT}
        />
      )}
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  rows = 3,
  placeholder,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          rows={rows}
          value={value}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${INPUT} resize-y`}
        />
      )}
    </Field>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  required,
  disabled,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Field label={label} hint={hint} required={required} className={className}>
      {({ id, describedBy }) => (
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/**
 * A field that lives *on* the invoice rather than in a form beside it.
 *
 * The document layout has no room for a visible label above every box, so the
 * label moves to `aria-label` and the placeholder carries the hint visually.
 * That is the one place placeholder-as-label is defensible — the surrounding
 * document supplies the context a sighted reader needs ("Bill To" above the
 * box), and the accessible name is still there in full for everyone else.
 */
export function DocField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  align = 'left',
  inputMode,
  bold,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  align?: 'left' | 'right';
  inputMode?: 'text' | 'decimal' | 'numeric' | 'email' | 'tel';
  bold?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      aria-label={label}
      placeholder={placeholder ?? label}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition placeholder:text-faint focus:border-accent ${
        align === 'right' ? 'text-right' : ''
      } ${bold ? 'font-medium' : ''} ${className}`}
    />
  );
}

/** Collapsible detail that keeps the document uncluttered by default. */
export function DocDetails({
  summary,
  children,
  incomplete,
}: {
  summary: string;
  children: React.ReactNode;
  /** Shows a dot when the ruleset needs something in here that is missing. */
  incomplete?: boolean;
}) {
  return (
    <details className="group mt-2">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-medium text-accent-hi transition hover:bg-accent-dim/40">
        {incomplete && (
          <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-label="Something here is still needed" />
        )}
        <span className="group-open:hidden">+ {summary}</span>
        <span className="hidden group-open:inline">− {summary}</span>
      </summary>
      <div className="mt-3 grid gap-3 rounded-lg border border-border bg-bg p-3 sm:grid-cols-2">{children}</div>
    </details>
  );
}

/** A titled group of fields. Sections are landmarks, so they get a heading. */
export function Section({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export const BUTTON_PRIMARY =
  'sb-press inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-40';

export const BUTTON_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-muted transition hover:border-border-hi hover:text-text disabled:cursor-not-allowed disabled:opacity-40';

export const BUTTON_QUIET =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-accent-hi transition hover:bg-accent-dim/50 disabled:opacity-40';

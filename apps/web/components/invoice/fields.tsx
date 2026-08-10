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
  'inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-40';

export const BUTTON_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-muted transition hover:border-border-hi hover:text-text disabled:cursor-not-allowed disabled:opacity-40';

export const BUTTON_QUIET =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-accent-hi transition hover:bg-accent-dim/50 disabled:opacity-40';

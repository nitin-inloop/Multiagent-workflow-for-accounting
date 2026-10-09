'use client';

import { useState } from 'react';
import { figure, round2 } from '@/lib/format';

/**
 * One ruled row of the extraction sheet: printed label on the left, editable
 * value on the right. A field named by an exception carries a stamp-red edge,
 * so the eye lands on what needs fixing without reading anything.
 *
 * The label is a real <label for>, so every figure on this sheet has a name a
 * screen reader can announce.
 */
export function FieldRow({
  id,
  label,
  hint,
  flagged,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  flagged?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rule-b grid grid-cols-[minmax(96px,132px)_minmax(0,1fr)] items-center gap-3 py-1.5 pr-1 ${
        flagged ? 'border-l-2 border-l-stamp bg-stamp-wash/40 pl-3' : 'pl-[14px]'
      }`}
    >
      <div>
        <label htmlFor={id} className="eyebrow block leading-tight">
          {label}
        </label>
        {hint ? <span className="mt-0.5 block text-[11px] text-ink-faint">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** A row whose control is a group rather than a single input. */
export function FieldGroupRow({
  label,
  hint,
  flagged,
  children,
}: {
  label: string;
  hint?: string;
  flagged?: boolean;
  children: React.ReactNode;
}) {
  return (
    <fieldset
      className={`rule-b grid grid-cols-[minmax(96px,132px)_minmax(0,1fr)] items-center gap-3 py-1.5 pr-1 ${
        flagged ? 'border-l-2 border-l-stamp bg-stamp-wash/40 pl-3' : 'pl-[14px]'
      }`}
    >
      <div>
        <legend className="eyebrow block leading-tight">{label}</legend>
        {hint ? <span className="mt-0.5 block text-[11px] text-ink-faint">{hint}</span> : null}
      </div>
      {children}
    </fieldset>
  );
}

const inputBase =
  'w-full bg-transparent px-2 py-1.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-faint/70';
const editable = 'hover:bg-paper-raised focus:bg-paper-raised';
const locked = 'cursor-default text-ink-soft';

/** A locked field is still readable and copyable, just not writable. */
const shell = (isLocked: boolean, extra = '') =>
  `${inputBase} ${isLocked ? locked : editable} ${extra}`;

export function TextField({
  id,
  value,
  onChange,
  placeholder,
  mono = false,
  uppercase = false,
  maxLength,
  readOnly = false,
}: {
  id: string;
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder?: string;
  mono?: boolean;
  uppercase?: boolean;
  maxLength?: number;
  readOnly?: boolean;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value ?? ''}
      maxLength={maxLength}
      readOnly={readOnly}
      onChange={(event) => {
        const next = uppercase ? event.target.value.toUpperCase() : event.target.value;
        onChange(next.length === 0 ? null : next);
      }}
      placeholder={placeholder ?? 'not read'}
      className={shell(readOnly, mono ? 'font-mono tracking-[0.02em]' : '')}
    />
  );
}

export function DateField({
  id,
  value,
  onChange,
  readOnly = false,
}: {
  id: string;
  value: string | null;
  onChange: (next: string | null) => void;
  readOnly?: boolean;
}) {
  return (
    <input
      id={id}
      type="date"
      value={value ?? ''}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value.length === 0 ? null : event.target.value)}
      className={shell(readOnly, 'font-mono')}
    />
  );
}

/**
 * Money reads as money. A plain number input shows 40000, which is exactly the
 * ambiguity this product exists to remove, so the field groups its digits while
 * you are not typing in it and hands you the raw number the moment you are.
 */
export function AmountField({
  id,
  value,
  onChange,
  align = 'right',
  placeholder = 'not read',
  readOnly = false,
}: {
  id: string;
  value: number | null;
  onChange: (next: number | null) => void;
  align?: 'left' | 'right';
  placeholder?: string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState('');

  const display = editing ? buffer : value === null ? '' : figure(value);

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={display}
      readOnly={readOnly}
      onFocus={() => {
        if (readOnly) return;
        setBuffer(value === null ? '' : String(value));
        setEditing(true);
      }}
      onChange={(event) => {
        // Accept digits, one dot and a leading minus while typing.
        const raw = event.target.value.replace(/[^0-9.\-]/g, '');
        setBuffer(raw);
        if (raw.trim().length === 0) {
          onChange(null);
          return;
        }
        const parsed = Number.parseFloat(raw);
        if (Number.isFinite(parsed)) onChange(round2(parsed));
      }}
      onBlur={() => setEditing(false)}
      placeholder={placeholder}
      className={shell(readOnly, `font-mono tabular-nums ${align === 'right' ? 'text-right' : ''}`)}
    />
  );
}

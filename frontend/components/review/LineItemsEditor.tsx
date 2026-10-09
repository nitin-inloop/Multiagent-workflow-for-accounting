'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { figure, round2 } from '@/lib/format';
import type { LineItem } from '@/lib/types';

/**
 * Line items in the same ruled-column form as the ledger, editable in place.
 * The row amount is computed from quantity and rate when the bill did not print
 * one, and the column foots so the taxable value can be checked at a glance.
 */
export function LineItemsEditor({
  items,
  onChange,
  locked = false,
}: {
  items: LineItem[];
  onChange: (next: LineItem[]) => void;
  locked?: boolean;
}) {
  const update = (index: number, patch: Partial<LineItem>) => {
    onChange(items.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  };

  const rowAmount = (item: LineItem): number | null => {
    if (typeof item.amount === 'number') return item.amount;
    if (typeof item.quantity === 'number' && typeof item.rate === 'number') {
      return Math.round((item.quantity * item.rate + Number.EPSILON) * 100) / 100;
    }
    return null;
  };

  const footed = items.reduce<number | null>((accumulator, item) => {
    const amount = rowAmount(item);
    if (amount === null) return accumulator;
    return Math.round(((accumulator ?? 0) + amount + Number.EPSILON) * 100) / 100;
  }, null);

  return (
    <div className="border border-rule bg-paper">
      <div className="rule-b flex items-center justify-between bg-paper-raised px-[14px] py-2.5">
        <h3 className="eyebrow">Line items</h3>
        {locked ? (
          <span className="eyebrow text-ledger">Locked</span>
        ) : (
          <button
            type="button"
            onClick={() =>
              onChange([...items, { name: '', quantity: null, rate: null, amount: null, hsn: null }])
            }
            className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-soft hover:text-ink"
          >
            <Plus aria-hidden className="h-3 w-3" />
            Add a row
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="px-[14px] py-6 text-[13.5px] text-ink-faint">
          No line items were read. Add rows if the bill lists them, or leave it empty and check the
          invoice total instead.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="rule-b">
                <th scope="col" className="eyebrow px-[14px] py-2 text-left font-normal">
                  Item
                </th>
                <th scope="col" className="eyebrow w-[86px] px-2 py-2 text-left font-normal">
                  HSN
                </th>
                <th scope="col" className="eyebrow w-[74px] px-2 py-2 text-right font-normal">
                  Qty
                </th>
                <th scope="col" className="eyebrow w-[96px] px-2 py-2 text-right font-normal">
                  Rate
                </th>
                <th scope="col" className="eyebrow w-[108px] px-2 py-2 text-right font-normal">
                  Amount
                </th>
                {locked ? null : (
                  <th scope="col" className="w-[40px] px-2 py-2">
                    <span className="sr-only">Remove</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="green-bar">
              {items.map((item, index) => {
                const row = item.name || `row ${index + 1}`;
                return (
                <tr key={index} className="rule-b">
                  <td className="px-[10px] py-1">
                    <CellInput
                      label={`Item description, row ${index + 1}`}
                      value={item.name}
                      onChange={(next) => update(index, { name: next ?? '' })}
                      placeholder="description"
                      readOnly={locked}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CellInput
                      label={`HSN code for ${row}`}
                      value={item.hsn}
                      onChange={(next) => update(index, { hsn: next })}
                      placeholder="—"
                      mono
                      readOnly={locked}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CellNumber
                      label={`Quantity of ${row}`}
                      value={item.quantity}
                      onChange={(next) => update(index, { quantity: next })}
                      group={false}
                      readOnly={locked}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CellNumber
                      label={`Rate for ${row}`}
                      value={item.rate}
                      onChange={(next) => update(index, { rate: next })}
                      readOnly={locked}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CellNumber
                      label={`Amount for ${row}`}
                      value={item.amount}
                      onChange={(next) => update(index, { amount: next })}
                      placeholder={
                        rowAmount(item) === null ? 'not read' : figure(rowAmount(item))
                      }
                      readOnly={locked}
                    />
                  </td>
                  {locked ? null : (
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => onChange(items.filter((_, position) => position !== index))}
                        className="text-ink-faint transition-colors hover:text-stamp"
                        aria-label={`Remove ${item.name || 'this row'}`}
                      >
                        <Trash2 aria-hidden className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="px-[14px] py-2.5 text-right">
                  <span className="eyebrow">Rows add up to</span>
                </td>
                <td className="px-3 py-2.5 text-right text-[14px] font-medium text-ink" data-figure>
                  {figure(footed)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

const cellBase =
  'w-full bg-transparent px-1.5 py-1 text-[13px] text-ink outline-none placeholder:text-ink-faint/70 focus:bg-paper-raised';

function CellInput({
  label,
  value,
  onChange,
  placeholder,
  mono = false,
  readOnly = false,
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder?: string;
  mono?: boolean;
  readOnly?: boolean;
}) {
  return (
    <input
      type="text"
      aria-label={label}
      value={value ?? ''}
      placeholder={placeholder}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value.length === 0 ? null : event.target.value)}
      className={`${cellBase} ${mono ? 'font-mono' : ''} ${
        readOnly ? 'cursor-default text-ink-soft' : ''
      }`}
    />
  );
}

/** Same grouped-while-idle behaviour as the field sheet, in a table cell. */
function CellNumber({
  label,
  value,
  onChange,
  placeholder = '—',
  group = true,
  readOnly = false,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
  group?: boolean;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState('');

  const idle = value === null ? '' : group ? figure(value) : String(value);

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={editing ? buffer : idle}
      placeholder={placeholder}
      readOnly={readOnly}
      onFocus={() => {
        if (readOnly) return;
        setBuffer(value === null ? '' : String(value));
        setEditing(true);
      }}
      onChange={(event) => {
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
      className={`${cellBase} text-right font-mono tabular-nums ${
        readOnly ? 'cursor-default text-ink-soft' : ''
      }`}
    />
  );
}

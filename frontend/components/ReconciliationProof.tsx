'use client';

import { figure, signedFigure, taxTotal, taxableValue } from '@/lib/format';
import type { InvoiceFields } from '@/lib/types';

/**
 * The arithmetic, worked out in a column the way an accountant checks a bill
 * with a pencil: taxable value, each GST component, a rule, the computed total,
 * and the figure actually printed on the invoice. When those two disagree the
 * difference is stated outright.
 *
 * This is the whole product argument in one block - the accountant does not
 * read a badge saying "total mismatch", they see where the money went.
 */
export function ReconciliationProof({
  fields,
  size = 'default',
}: {
  fields: InvoiceFields;
  size?: 'default' | 'compact';
}) {
  const taxable = taxableValue(fields);
  const tax = taxTotal(fields);
  const computed = taxable === null ? null : Math.round((taxable + tax + Number.EPSILON) * 100) / 100;
  const printed = fields.total;
  const delta =
    computed === null || printed === null
      ? null
      : Math.round((printed - computed + Number.EPSILON) * 100) / 100;
  const reconciles = delta !== null && Math.abs(delta) <= 1;

  const rows: Array<{ label: string; value: number | null; op?: string }> = [
    { label: 'Taxable value', value: taxable },
  ];
  if (fields.tax.cgst !== null) rows.push({ label: 'CGST', value: fields.tax.cgst, op: '+' });
  if (fields.tax.sgst !== null) rows.push({ label: 'SGST', value: fields.tax.sgst, op: '+' });
  if (fields.tax.igst !== null) rows.push({ label: 'IGST', value: fields.tax.igst, op: '+' });

  const scale =
    size === 'compact'
      ? { row: 'text-[13px]', total: 'text-[15px]', gap: 'py-[3px]' }
      : { row: 'text-sm', total: 'text-lg', gap: 'py-1' };

  return (
    <figure className="w-full max-w-[420px]">
      <table className="w-full border-collapse">
        <caption className="eyebrow mb-2.5 text-left">Arithmetic check</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={scale.row}>
              <td aria-hidden className="w-4 text-ink-faint" data-figure>
                {row.op ?? ''}
              </td>
              <td className={`${scale.gap} pr-4 text-ink-soft`}>{row.label}</td>
              <td className={`${scale.gap} text-right text-ink`} data-figure>
                {figure(row.value)}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="pt-1">
              <div className="h-px w-full bg-rule-strong" />
            </td>
          </tr>
          <tr className={scale.row}>
            <td aria-hidden />
            <td className="py-1 pr-4 text-ink-soft">Computed</td>
            <td className="py-1 text-right text-ink" data-figure>
              {figure(computed)}
            </td>
          </tr>
          <tr className={scale.row}>
            <td aria-hidden />
            <td className="pb-1 pr-4 text-ink-soft">On the bill</td>
            <td className="pb-1 text-right text-ink" data-figure>
              {figure(printed)}
            </td>
          </tr>
          <tr>
            <td colSpan={3}>
              <div className="h-px w-full bg-rule-strong" />
            </td>
          </tr>
          <tr>
            <td aria-hidden />
            <td
              className={`pt-2 pr-4 font-display font-semibold ${
                reconciles ? 'text-ledger' : 'text-stamp'
              } ${scale.total}`}
            >
              {delta === null ? 'Cannot check' : reconciles ? 'Reconciles' : 'Off by'}
            </td>
            <td
              className={`pt-2 text-right font-semibold ${
                reconciles ? 'text-ledger' : 'text-stamp'
              } ${scale.total}`}
              data-figure
            >
              {delta === null ? '—' : reconciles ? figure(printed) : signedFigure(delta)}
            </td>
          </tr>
        </tbody>
      </table>
      {delta === null ? (
        <figcaption className="mt-2.5 text-[13px] leading-snug text-ink-faint">
          The taxable value did not come through, so the total cannot be proved. Fill it in on the
          review screen.
        </figcaption>
      ) : null}
    </figure>
  );
}

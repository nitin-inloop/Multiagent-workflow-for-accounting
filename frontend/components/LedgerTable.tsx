'use client';

import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { ConfidenceMeter, StatusChip } from './StatusChip';
import { exceptionLabel, figure, shortDate } from '@/lib/format';
import type { InvoiceDocument } from '@/lib/types';

/**
 * The inbox as a ledger sheet: hairline column rules, alternating green bars,
 * every figure right-aligned in a monospace column. Rows carry their own
 * exception tags so the queue can be triaged without opening anything.
 */
export function LedgerTable({ documents }: { documents: InvoiceDocument[] }) {
  if (documents.length === 0) {
    return (
      <div className="rule-t px-5 py-16 text-center sm:px-8">
        <p className="font-display text-lg text-ink">Nothing in the inbox yet.</p>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-ink-soft">
          Drop a supplier invoice above, or pick one of the sample bills to see the extraction and
          the review queue work end to end.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-left">
        <thead>
          <tr className="rule-t rule-b bg-paper-raised">
            <Th className="w-[132px]">Status</Th>
            <Th>Vendor</Th>
            <Th className="w-[148px]">Invoice no.</Th>
            <Th className="w-[108px]">Date</Th>
            <Th align="right" className="w-[128px]">
              Total
            </Th>
            <Th className="w-[112px]">Confidence</Th>
            <Th className="w-[210px]">Flags</Th>
            <Th className="w-[92px]" align="right">
              <span className="sr-only">Open</span>
            </Th>
          </tr>
        </thead>
        <tbody className="green-bar">
          {documents.map((document, index) => (
            <LedgerRow key={document.documentId} document={document} index={index} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className = '',
  align = 'left',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
}) {
  return (
    <th
      scope="col"
      className={`eyebrow px-3 py-2.5 font-normal first:pl-5 last:pr-5 sm:first:pl-8 sm:last:pr-8 ${
        align === 'right' ? 'text-right' : ''
      } ${className}`}
    >
      {children}
    </th>
  );
}

function LedgerRow({ document, index }: { document: InvoiceDocument; index: number }) {
  const { fields } = document;
  const processing = document.status === 'PROCESSING';

  return (
    <tr
      className="feed rule-b align-middle transition-colors hover:bg-paper-raised"
      style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
    >
      <Td className="w-[132px]">
        <StatusChip status={document.status} />
      </Td>

      <Td>
        <Link
          href={`/documents/${document.documentId}`}
          className="group block max-w-[280px] truncate font-display text-[14.5px] font-medium text-ink hover:text-ledger"
        >
          {fields.vendorName ?? (processing ? 'Reading the document…' : 'Vendor not read')}
        </Link>
        <span className="mt-0.5 block truncate text-[11.5px] text-ink-faint" data-figure>
          {fields.gstin ?? 'GSTIN —'}
        </span>
      </Td>

      <Td className="text-[13px]" figureCell>
        {fields.invoiceNumber ?? '—'}
      </Td>

      <Td className="whitespace-nowrap text-[13px] text-ink-soft" figureCell>
        {shortDate(fields.invoiceDate)}
      </Td>

      <Td align="right" className="text-[14px] font-medium" figureCell>
        {figure(fields.total)}
      </Td>

      <Td>
        {processing ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint">
            <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
            reading
          </span>
        ) : (
          <ConfidenceMeter value={document.confidence} />
        )}
      </Td>

      <Td>
        {document.exceptions.length === 0 ? (
          <span className="text-[12.5px] text-ledger">clean</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {document.exceptions.slice(0, 2).map((exception) => (
              <span
                key={exception.code}
                className={`px-1.5 py-[2px] font-mono text-[10.5px] uppercase tracking-[0.06em] ${
                  exception.severity === 'BLOCKING'
                    ? 'bg-stamp-wash text-stamp'
                    : 'bg-ochre-wash text-ochre'
                }`}
              >
                {exceptionLabel(exception.code)}
              </span>
            ))}
            {document.exceptions.length > 2 ? (
              <span className="px-1 py-[2px] font-mono text-[10.5px] text-ink-faint">
                +{document.exceptions.length - 2}
              </span>
            ) : null}
          </span>
        )}
      </Td>

      <Td align="right">
        <Link
          href={`/documents/${document.documentId}`}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft hover:text-ink"
        >
          {document.status === 'NEEDS_REVIEW' ? 'Review' : 'Open'}
          <ArrowRight aria-hidden className="h-3 w-3" />
        </Link>
      </Td>
    </tr>
  );
}

function Td({
  children,
  className = '',
  align = 'left',
  figureCell = false,
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
  figureCell?: boolean;
}) {
  return (
    <td
      {...(figureCell ? { 'data-figure': '' } : {})}
      className={`px-3 py-3 first:pl-5 last:pr-5 sm:first:pl-8 sm:last:pr-8 ${
        align === 'right' ? 'text-right' : ''
      } ${className}`}
    >
      {children}
    </td>
  );
}

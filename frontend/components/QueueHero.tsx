'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ReconciliationProof } from './ReconciliationProof';
import { shortDate } from '@/lib/format';
import type { DocumentStats, InvoiceDocument } from '@/lib/types';

const WORDS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
];

function spell(count: number): string {
  return WORDS[count] ?? String(count);
}

/**
 * The page opens on the actual work, not a summary: the first invoice in the
 * queue, with its arithmetic laid out. If the queue is empty it says so and
 * points at the export instead.
 */
export function QueueHero({
  stats,
  first,
  latestApproved,
}: {
  stats: DocumentStats | null;
  first: InvoiceDocument | null;
  latestApproved: InvoiceDocument | null;
}) {
  const needsReview = stats?.needsReview ?? 0;
  const cleared = (stats?.readyForApproval ?? 0) + (stats?.approved ?? 0) + (stats?.exported ?? 0);
  const feature = first ?? latestApproved;

  return (
    <section className="mx-auto grid max-w-[1180px] gap-x-12 gap-y-8 px-5 pt-10 pb-9 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
      <div>
        <p className="eyebrow">The queue</p>

        <h1 className="mt-4 max-w-[16ch] font-display text-[clamp(2.1rem,5.6vw,3.4rem)] leading-[1.02] font-bold tracking-[-0.035em] text-ink">
          {needsReview === 0 ? (
            <>Nothing needs you right now.</>
          ) : (
            <>
              {spell(needsReview)} invoice{needsReview === 1 ? '' : 's'}{' '}
              <span className="text-stamp">need{needsReview === 1 ? 's' : ''} you.</span>
            </>
          )}
        </h1>

        <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-ink-soft">
          {cleared === 0
            ? 'LedgerFlow reads every bill, checks the GST arithmetic, and only asks for you when something does not add up.'
            : `${spell(cleared)} ${
                cleared === 1 ? 'bill' : 'bills'
              } cleared the checks on their own and went straight to the export. Nobody typed them.`}
        </p>

        <dl className="mt-8 grid max-w-md grid-cols-2 gap-px bg-rule">
          <Metric
            label="Straight through"
            value={`${Math.round((stats?.straightThroughRate ?? 0) * 100)}%`}
            note="cleared with no correction"
          />
          <Metric
            label="Typing avoided"
            value={`${stats?.minutesSaved ?? 0} min`}
            note="at three minutes a bill"
          />
        </dl>
      </div>

      {feature ? (
        <aside className="border border-rule bg-paper-raised">
          <div className="rule-b flex items-baseline justify-between gap-3 px-5 py-3">
            <span className="eyebrow">
              {first ? 'Top of the queue' : 'Last one out the door'}
            </span>
            <span className="eyebrow" data-figure>
              {feature.fields.invoiceNumber ?? feature.documentId}
            </span>
          </div>

          <div className="px-5 pt-4">
            <p className="font-display text-[19px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              {feature.fields.vendorName ?? 'Vendor not read'}
            </p>
            <p className="mt-1 text-[12.5px] text-ink-faint">
              {feature.fields.placeOfSupply ?? 'Place of supply not printed'} ·{' '}
              <span data-figure>{shortDate(feature.fields.invoiceDate)}</span>
            </p>
          </div>

          <div className="px-5 pt-5">
            <ReconciliationProof fields={feature.fields} />
          </div>

          {feature.exceptions.length > 0 ? (
            <p className="mx-5 mt-5 border-l-2 border-stamp bg-stamp-wash px-3 py-2.5 text-[13px] leading-snug text-stamp">
              {feature.exceptions[0].message}
            </p>
          ) : (
            <p className="mx-5 mt-5 border-l-2 border-ledger bg-ledger-wash px-3 py-2.5 text-[13px] leading-snug text-ledger">
              Every check passed. Approved and ready for Tally.
            </p>
          )}

          <div className="mt-5 rule-t px-5 py-3">
            <Link
              href={`/documents/${feature.documentId}`}
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink hover:text-ledger"
            >
              {first ? 'Review this bill' : 'Open the entry'}
              <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>
      ) : null}
    </section>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-paper px-4 py-3">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.03em] text-ink" data-figure>
        {value}
      </dd>
      <dd className="mt-0.5 text-[12px] text-ink-faint">{note}</dd>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ConnectorRail } from '@/components/ConnectorRail';
import { FilterRail, type FilterKey } from '@/components/FilterRail';
import { LedgerTable } from '@/components/LedgerTable';
import { QueueHero } from '@/components/QueueHero';
import { TopRail } from '@/components/TopRail';
import { UploadPanel } from '@/components/UploadPanel';
import { api, ApiError } from '@/lib/api';
import { triageRank } from '@/lib/format';
import type { DocumentStats, InvoiceDocument } from '@/lib/types';

const POLL_INTERVAL_MS = 3000;

export default function InboxPage() {
  const [documents, setDocuments] = useState<InvoiceDocument[]>([]);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // State lands in the promise callbacks rather than in the effect body, so a
  // poll tick never cascades a synchronous re-render.
  const refresh = useCallback(
    () =>
      api.listDocuments().then(
        (response) => {
          setDocuments(response.documents);
          setStats(response.stats);
          setError(null);
          setLoaded(true);
        },
        (caught: unknown) => {
          setError(caught instanceof ApiError ? caught.message : 'Could not load the inbox.');
          setLoaded(true);
        },
      ),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll while anything is still being read, so a fresh upload lands on its own.
  const hasProcessing = documents.some((document) => document.status === 'PROCESSING');
  useEffect(() => {
    if (!hasProcessing) return;
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasProcessing, refresh]);

  const visible = useMemo(() => {
    const scoped =
      filter === 'ALL' ? documents : documents.filter((document) => document.status === filter);
    // Same triage order as the hero, so the two views never disagree about
    // which bill is most urgent. Everything settled falls back to recency.
    return [...scoped].sort((a, b) => {
      const aQueued = a.status === 'NEEDS_REVIEW';
      const bQueued = b.status === 'NEEDS_REVIEW';
      if (aQueued !== bQueued) return aQueued ? -1 : 1;
      if (aQueued && bQueued) {
        const byRank = triageRank(a) - triageRank(b);
        if (byRank !== 0) return byRank;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [documents, filter]);

  // Whichever exception costs the most to get wrong goes to the top.
  const firstInQueue = useMemo(() => {
    const queue = documents.filter((document) => document.status === 'NEEDS_REVIEW');
    if (queue.length === 0) {
      return documents.find((document) => document.status === 'READY_FOR_APPROVAL') ?? null;
    }
    return [...queue].sort(
      (a, b) => triageRank(a) - triageRank(b) || b.createdAt.localeCompare(a.createdAt),
    )[0];
  }, [documents]);

  const latestApproved = useMemo(
    () =>
      documents.find(
        (document) => document.status === 'EXPORTED' || document.status === 'APPROVED',
      ) ?? null,
    [documents],
  );

  return (
    <>
      <TopRail />

      <main className="flex-1">
        {error ? (
          <div role="alert" className="rule-b bg-stamp-wash">
            <div className="mx-auto flex max-w-[1180px] items-start gap-3 px-5 py-3 sm:px-8">
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-stamp" />
              <div className="text-[13.5px] leading-snug text-stamp">
                <p>{error}</p>
                <p className="mt-1 text-stamp/80">
                  Start the API with <code className="font-mono">npm run dev</code> inside{' '}
                  <code className="font-mono">backend/</code>, then retry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                className="ml-auto inline-flex shrink-0 items-center gap-1.5 border border-stamp/40 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-stamp hover:bg-stamp hover:text-paper"
              >
                <RefreshCw aria-hidden className="h-3 w-3" />
                Retry
              </button>
            </div>
          </div>
        ) : null}

        <QueueHero stats={stats} first={firstInQueue} latestApproved={latestApproved} />

        <UploadPanel onQueued={() => void refresh()} />

        <section aria-labelledby="ledger" className="pt-9">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-end justify-between gap-3 px-5 pb-4 sm:px-8">
            <h2 id="ledger" className="font-display text-xl font-semibold tracking-[-0.025em] text-ink">
              Document ledger
            </h2>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
            >
              <RefreshCw aria-hidden className="h-3 w-3" />
              Refresh
            </button>
          </div>

          <FilterRail stats={stats} active={filter} onChange={setFilter} />

          <div className="mx-auto mt-px max-w-[1180px]">
            {loaded ? (
              <LedgerTable documents={visible} />
            ) : (
              <p className="px-5 py-16 text-center text-[14px] text-ink-faint sm:px-8">
                Loading the ledger…
              </p>
            )}
          </div>
        </section>

        <div className="mt-12">
          <ConnectorRail />
        </div>
      </main>

      <footer className="rule-t bg-paper-raised">
        <div className="mx-auto max-w-[1180px] px-5 py-5 sm:px-8">
          <p className="max-w-3xl text-[13px] leading-relaxed text-ink-faint">
            LedgerFlow never invents an invoice value and never posts an entry that a person did not
            approve. Uncertain fields are marked missing, arithmetic is checked in code rather than
            by a model, and every correction, approval and export is recorded in the audit trail.
          </p>
        </div>
      </footer>
    </>
  );
}

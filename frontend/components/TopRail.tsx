'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { HealthReport } from '@/lib/types';

/**
 * The sheet header: who the ledger belongs to, and which extraction path is
 * live. The adapter readout is not decoration - during a demo it answers
 * "is this really running on AWS?" without opening a terminal.
 */
export function TopRail({ crumb }: { crumb?: string }) {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((report) => {
        if (!cancelled) setHealth(report);
      })
      .catch(() => {
        if (!cancelled) setUnreachable(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const engine = health?.adapters.textract
    ? health.adapters.gemini
      ? 'Textract + Gemini'
      : 'Textract'
    : health?.adapters.gemini
      ? 'Gemini vision'
      : 'Sample extraction';

  return (
    <header className="rule-b bg-paper-raised">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 sm:px-8">
        <Link href="/" className="group flex items-baseline gap-2.5">
          <span className="font-display text-[15px] font-bold tracking-[-0.02em] text-ink">
            Ledger<span className="text-ledger">Flow</span>
          </span>
          <span className="eyebrow hidden sm:inline">Nagar Enterprises · Bhopal</span>
        </Link>

        {crumb ? (
          <span className="eyebrow flex items-center gap-2 text-ink-soft">
            <span aria-hidden className="text-rule-strong">
              /
            </span>
            {crumb}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-4">
          <span className="eyebrow" data-figure>
            {unreachable ? 'API offline' : engine}
          </span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              unreachable ? 'bg-stamp' : health ? 'bg-ledger' : 'bg-ink-faint'
            }`}
            aria-hidden
          />
          <span className="sr-only">
            {unreachable
              ? 'The LedgerFlow API is not reachable.'
              : health
                ? `Connected. Extraction by ${engine}.`
                : 'Connecting.'}
          </span>
        </div>
      </div>
    </header>
  );
}

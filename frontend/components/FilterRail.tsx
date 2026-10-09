'use client';

import type { DocumentStats, DocumentStatus } from '@/lib/types';

export type FilterKey = 'ALL' | DocumentStatus;

/**
 * Counts and filters in one rail. The numbers are the filter, because a count
 * you cannot act on is just decoration.
 */
export function FilterRail({
  stats,
  active,
  onChange,
}: {
  stats: DocumentStats | null;
  active: FilterKey;
  onChange: (key: FilterKey) => void;
}) {
  const tabs: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'ALL', label: 'All', count: stats?.total ?? 0 },
    { key: 'NEEDS_REVIEW', label: 'Needs review', count: stats?.needsReview ?? 0 },
    { key: 'READY_FOR_APPROVAL', label: 'Ready', count: stats?.readyForApproval ?? 0 },
    { key: 'APPROVED', label: 'Approved', count: stats?.approved ?? 0 },
    { key: 'EXPORTED', label: 'Exported', count: stats?.exported ?? 0 },
  ];

  if ((stats?.processing ?? 0) > 0) {
    tabs.splice(1, 0, { key: 'PROCESSING', label: 'Reading', count: stats?.processing ?? 0 });
  }

  return (
    <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
      <div
        role="tablist"
        aria-label="Filter the inbox by status"
        className="flex flex-wrap items-stretch gap-px bg-rule"
      >
        {tabs.map((tab) => {
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => onChange(tab.key)}
              className={`flex min-w-[112px] flex-1 flex-col items-start gap-1 px-4 py-3 text-left transition-colors ${
                selected ? 'bg-ink text-paper' : 'bg-paper-raised text-ink hover:bg-bar'
              }`}
            >
              <span
                className={`font-mono text-[10.5px] uppercase tracking-[0.12em] ${
                  selected ? 'text-paper/70' : 'text-ink-faint'
                }`}
              >
                {tab.label}
              </span>
              <span className="font-display text-xl font-semibold tracking-[-0.03em]" data-figure>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

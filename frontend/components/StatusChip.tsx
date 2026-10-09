import { STATUS_META } from '@/lib/format';
import type { DocumentStatus } from '@/lib/types';

export function StatusChip({ status, className = '' }: { status: DocumentStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-[3px] font-mono text-[10.5px] uppercase tracking-[0.1em] ${meta.chip} ${className}`}
    >
      <span aria-hidden className={`h-[5px] w-[5px] rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

/** Confidence as a five-segment meter: coarse on purpose, like a signal bar. */
export function ConfidenceMeter({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-ink-faint" data-figure>—</span>;
  }
  const filled = Math.max(1, Math.min(5, Math.ceil(value * 5)));
  const tone = value >= 0.9 ? 'bg-ledger' : value >= 0.75 ? 'bg-ready' : 'bg-stamp';

  return (
    <span className="inline-flex items-center gap-2" title={`${Math.round(value * 100)}% confidence`}>
      <span aria-hidden className="flex items-end gap-[2px]">
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            key={index}
            className={`w-[3px] ${index < filled ? tone : 'bg-rule'}`}
            style={{ height: `${6 + index * 2}px` }}
          />
        ))}
      </span>
      <span className="text-[12.5px] text-ink-soft" data-figure>
        {Math.round(value * 100)}%
      </span>
    </span>
  );
}

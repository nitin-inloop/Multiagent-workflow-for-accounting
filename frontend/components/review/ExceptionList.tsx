import { AlertOctagon, CheckCircle2, Info } from 'lucide-react';
import { exceptionLabel } from '@/lib/format';
import type { InvoiceException } from '@/lib/types';

/**
 * Exceptions, blocking first. Each one states what is wrong in a full sentence
 * rather than a code, because the accountant has to act on it.
 */
export function ExceptionList({ exceptions }: { exceptions: InvoiceException[] }) {
  if (exceptions.length === 0) {
    return (
      <div className="flex items-start gap-2.5 border border-ledger/25 bg-ledger-wash px-4 py-3">
        <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ledger" />
        <p className="text-[13.5px] leading-snug text-ledger">
          Every check passed. Vendor, GSTIN, tax split and totals all reconcile.
        </p>
      </div>
    );
  }

  const ordered = [...exceptions].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'BLOCKING' ? -1 : 1,
  );

  return (
    <ul className="space-y-px bg-rule">
      {ordered.map((exception) => {
        const blocking = exception.severity === 'BLOCKING';
        const Icon = blocking ? AlertOctagon : Info;
        return (
          <li
            key={`${exception.code}-${exception.field ?? ''}`}
            className={`flex items-start gap-2.5 border-l-2 px-4 py-3 ${
              blocking
                ? 'border-l-stamp bg-stamp-wash'
                : 'border-l-ochre bg-ochre-wash'
            }`}
          >
            <Icon
              aria-hidden
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${blocking ? 'text-stamp' : 'text-ochre'}`}
            />
            <div className="min-w-0">
              <p
                className={`font-mono text-[10.5px] uppercase tracking-[0.1em] ${
                  blocking ? 'text-stamp' : 'text-ochre'
                }`}
              >
                {exceptionLabel(exception.code)}
                {blocking ? ' · blocks approval' : ' · note only'}
              </p>
              <p className="mt-1 text-[13.5px] leading-snug text-ink">{exception.message}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

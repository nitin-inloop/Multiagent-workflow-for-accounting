import { clockTime, shortDate } from '@/lib/format';
import type { AuditEvent } from '@/lib/types';

const ACTION_LABELS: Record<string, string> = {
  UPLOADED: 'Received',
  EXTRACTED: 'Read',
  NOTE: 'Note',
  CORRECTED: 'Corrected',
  REVIEWED: 'Reviewed',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPORTED: 'Exported',
  REMINDER_DRAFTED: 'Reminder drafted',
  FAILED: 'Failed',
};

const ACTOR_TONE: Record<string, string> = {
  APPROVED: 'text-ledger',
  EXPORTED: 'text-ledger',
  REJECTED: 'text-stamp',
  FAILED: 'text-stamp',
  CORRECTED: 'text-ready',
};

/**
 * The audit trail is the trust story: who touched the entry, what changed, and
 * when. It reads as a ledger of actions rather than a styled timeline.
 */
export function AuditTrail({ events }: { events: AuditEvent[] }) {
  return (
    <div className="border border-rule bg-paper">
      <div className="rule-b bg-paper-raised px-[14px] py-2.5">
        <h3 className="eyebrow">Audit trail · {events.length} entries</h3>
      </div>
      <ol className="green-bar">
        {events.map((event, index) => (
          <li
            key={`${event.at}-${index}`}
            className="rule-b px-[14px] py-2.5 last:border-b-0"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={`font-mono text-[10.5px] uppercase tracking-[0.1em] ${
                  ACTOR_TONE[event.action] ?? 'text-ink-soft'
                }`}
              >
                {ACTION_LABELS[event.action] ?? event.action}
              </span>
              <span className="whitespace-nowrap text-[11px] text-ink-faint" data-figure>
                {shortDate(event.at)} {clockTime(event.at)}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-ink">
              {event.detail ?? '—'}
              <span className="text-ink-faint"> — {event.actor}</span>
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { MailX, X } from 'lucide-react';
import type { EmailNotification } from '@/lib/types';

/**
 * Pops automatically after a reject, so the room sees what the vendor sees:
 * the invoice is declined and the details travelled by email.
 */
export function DeclineModal({
  notification,
  onClose,
}: {
  notification: EmailNotification;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-5"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="decline-title"
        className="w-full max-w-md border border-rule-strong bg-paper shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rule-b flex items-center justify-between gap-3 px-4 py-2.5">
          <h3 id="decline-title" className="eyebrow flex items-center gap-2 text-stamp">
            <MailX aria-hidden className="h-3.5 w-3.5" />
            Invoice declined
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-faint hover:text-ink"
            aria-label="Close the decline notice"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="px-4 py-4">
          <p className="text-[14.5px] leading-relaxed text-ink">
            Your invoice has been declined. Please check the email for further information.
          </p>
          <p className="mt-2 text-[12.5px] text-ink-faint">
            {notification.delivered
              ? `Decline notice emailed to ${notification.to}.`
              : `Decline notice prepared for ${notification.to}. Email delivery is not configured, so it was recorded in the audit trail instead.`}
          </p>

          <pre className="mt-3 whitespace-pre-wrap border border-rule bg-paper-raised px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-soft">
            {notification.body}
          </pre>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 inline-flex items-center gap-2 bg-ink px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-paper transition-colors hover:bg-ledger"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}

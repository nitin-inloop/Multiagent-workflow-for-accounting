'use client';

import { Mail, X } from 'lucide-react';
import type { InfoRequestResult } from '@/lib/types';

/**
 * Confirmation of the missing-credential email. Unlike the WhatsApp reminder,
 * which stays a draft on purpose, this one has already left (or, without
 * SMTP, been recorded), so the panel reports rather than asks.
 */
export function EmailRequestPanel({
  result,
  onClose,
}: {
  result: InfoRequestResult;
  onClose: () => void;
}) {
  return (
    <section aria-labelledby="info-request" className="border border-rule bg-paper-raised">
      <div className="rule-b flex items-center justify-between gap-3 px-4 py-2.5">
        <h3 id="info-request" className="eyebrow flex items-center gap-2">
          <Mail aria-hidden className="h-3.5 w-3.5" />
          {result.email.delivered ? 'Missing details requested' : 'Missing-detail request recorded'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-faint hover:text-ink"
          aria-label="Close the email confirmation"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-4 py-4">
        <p className="text-[13px] text-ink-soft">
          To <span data-figure>{result.email.to}</span> · {result.email.subject}
        </p>

        <pre className="mt-3 whitespace-pre-wrap border border-rule bg-paper px-3.5 py-3 text-[13.5px] leading-relaxed text-ink">
          {result.email.body}
        </pre>

        <p className="mt-3 text-[12px] text-ink-faint">{result.note}</p>
      </div>
    </section>
  );
}

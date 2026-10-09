'use client';

import { useState } from 'react';
import { Check, Copy, MessageCircle, X } from 'lucide-react';
import type { ReminderDraft } from '@/lib/types';

/**
 * The chase message, written for the accountant to send. It is a draft on
 * purpose: WhatsApp Business sending is a post-pilot integration, and a tool
 * that messages a supplier on its own is not something a CA firm would trust
 * on day one.
 */
export function ReminderPanel({
  draft,
  onClose,
}: {
  draft: ReminderDraft;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-labelledby="reminder" className="border border-rule bg-paper-raised">
      <div className="rule-b flex items-center justify-between gap-3 px-4 py-2.5">
        <h3 id="reminder" className="eyebrow flex items-center gap-2">
          <MessageCircle aria-hidden className="h-3.5 w-3.5" />
          Reminder draft
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-faint hover:text-ink"
          aria-label="Close the reminder draft"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-4 py-4">
        <pre className="whitespace-pre-wrap border border-rule bg-paper px-3.5 py-3 text-[13.5px] leading-relaxed text-ink">
          {draft.message}
        </pre>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex items-center gap-2 bg-ink px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-paper transition-colors hover:bg-ledger"
          >
            {copied ? (
              <Check aria-hidden className="h-3 w-3" />
            ) : (
              <Copy aria-hidden className="h-3 w-3" />
            )}
            {copied ? 'Copied' : 'Copy the message'}
          </button>
          <p className="text-[12px] text-ink-faint">{draft.note}</p>
        </div>
      </div>
    </section>
  );
}

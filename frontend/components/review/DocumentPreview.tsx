'use client';

import { ExternalLink, FileText } from 'lucide-react';
import { ENGINE_LABELS, relativeTime } from '@/lib/format';
import type { InvoiceDocument } from '@/lib/types';

/**
 * The original document, kept beside the extracted data so a field can always
 * be checked against the paper. Files are private: this is either a short-lived
 * signed URL or a stream through the API, never a public object.
 */
export function DocumentPreview({
  document,
  src,
}: {
  document: InvoiceDocument;
  src: string;
}) {
  const isPdf = document.mimeType === 'application/pdf';

  return (
    <div className="border border-rule bg-paper-raised">
      <div className="rule-b flex items-center justify-between gap-3 px-3.5 py-2.5">
        <h2 className="eyebrow">The document</h2>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-soft hover:text-ink"
        >
          Full size
          <ExternalLink aria-hidden className="h-3 w-3" />
        </a>
      </div>

      <div className="flex gap-0 bg-bar/50 p-3">
        {/* Tractor-feed edge, the tell of a continuous-feed accounting sheet. */}
        <div aria-hidden className="perforation w-3.5 shrink-0 opacity-70" />
        <div className="min-w-0 flex-1 border border-rule bg-white">
          {isPdf ? (
            <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
              <FileText aria-hidden className="h-6 w-6 text-ink-faint" />
              <p className="text-[13.5px] text-ink-soft">
                PDF bills open in a new tab for now.
              </p>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="bg-ink px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-paper hover:bg-ledger"
              >
                Open the PDF
              </a>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- the file is
               served from the API with a signed or streamed URL, which the Next
               image optimizer cannot fetch on the server. */
            <img
              src={src}
              alt={`Invoice from ${document.fields.vendorName ?? 'the supplier'}`}
              className="block h-auto w-full"
            />
          )}
        </div>
      </div>

      <dl className="rule-t grid grid-cols-2 gap-x-4 gap-y-2 px-3.5 py-3">
        <Meta label="File" value={document.fileName} mono />
        <Meta label="Read by" value={ENGINE_LABELS[document.extractionEngine] ?? '—'} />
        <Meta label="Arrived" value={relativeTime(document.createdAt)} />
        <Meta label="Size" value={`${Math.max(1, Math.round(document.fileSize / 1024))} KB`} mono />
      </dl>
    </div>
  );
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd
        className={`mt-0.5 truncate text-[12.5px] text-ink-soft ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

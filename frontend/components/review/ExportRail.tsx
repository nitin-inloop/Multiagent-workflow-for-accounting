'use client';

import { useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { api, ApiError, downloadArtifact } from '@/lib/api';
import type { ExportArtifact, InvoiceDocument } from '@/lib/types';

/**
 * The end of the workflow. Both formats are generated server-side from the
 * approved record, so what downloads is exactly what was approved.
 */
export function ExportRail({
  document,
  actor,
  onExported,
}: {
  document: InvoiceDocument;
  actor: string;
  onExported: (next: InvoiceDocument) => void;
}) {
  const [busy, setBusy] = useState<'csv' | 'tally' | null>(null);
  const [done, setDone] = useState<'csv' | 'tally' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ExportArtifact | null>(null);

  const run = async (format: 'csv' | 'tally') => {
    setBusy(format);
    setError(null);
    try {
      const response =
        format === 'csv'
          ? await api.exportCsv(document.documentId, actor)
          : await api.exportTally(document.documentId, actor);
      downloadArtifact(response.export);
      setPreview(response.export);
      setDone(format);
      onExported(response.document);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="export" className="border border-ledger/30 bg-ledger-wash">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ledger/20 px-4 py-3">
        <h3 id="export" className="eyebrow text-ledger">
          Accounting export
        </h3>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ledger/80">
          Approved by {actor}
        </p>
      </div>

      <div className="px-4 py-4">
        <p className="max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
          The entry is approved and locked to what you confirmed. Import the file into Tally, or take
          the CSV into Excel. LedgerFlow does not write into the books itself.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <ExportButton
            label="Download Tally XML"
            sublabel="Purchase voucher"
            active={busy === 'tally'}
            complete={done === 'tally'}
            primary
            onClick={() => void run('tally')}
          />
          <ExportButton
            label="Download CSV"
            sublabel="Excel or Sheets"
            active={busy === 'csv'}
            complete={done === 'csv'}
            onClick={() => void run('csv')}
          />
        </div>

        {error ? (
          <p role="alert" className="mt-3 border-l-2 border-stamp bg-stamp-wash px-3 py-2 text-[13px] text-stamp">
            {error}
          </p>
        ) : null}

        {preview ? (
          <details className="mt-4 border border-ledger/25 bg-paper">
            <summary className="cursor-pointer px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-soft">
              What was written · {preview.fileName}
            </summary>
            <pre className="max-h-72 overflow-auto border-t border-ledger/20 bg-paper-raised px-3 py-3 font-mono text-[11.5px] leading-relaxed text-ink-soft">
              {preview.body}
            </pre>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function ExportButton({
  label,
  sublabel,
  active,
  complete,
  primary = false,
  onClick,
}: {
  label: string;
  sublabel: string;
  active: boolean;
  complete: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      className={`group flex items-center gap-3 px-4 py-2.5 text-left transition-colors disabled:opacity-60 ${
        primary
          ? 'bg-ledger text-white hover:bg-ink'
          : 'border border-ledger/30 bg-paper text-ink hover:bg-paper-raised'
      }`}
    >
      {active ? (
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
      ) : complete ? (
        <Check aria-hidden className="h-4 w-4" />
      ) : (
        <Download aria-hidden className="h-4 w-4" />
      )}
      <span>
        <span className="block font-display text-[13.5px] font-medium">{label}</span>
        <span
          className={`block font-mono text-[10px] uppercase tracking-[0.1em] ${
            primary ? 'text-white/70' : 'text-ink-faint'
          }`}
        >
          {complete ? 'downloaded' : sublabel}
        </span>
      </span>
    </button>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { DemoInvoiceSummary } from '@/lib/types';

/**
 * Two ways in: drop a real invoice, or run one of the sample bills. The samples
 * exist so a walkthrough never depends on OCR reaching AWS, and each one is
 * labelled with the exception it demonstrates.
 */
export function UploadPanel({ onQueued }: { onQueued: () => void }) {
  const [samples, setSamples] = useState<DemoInvoiceSummary[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .demoInvoices()
      .then((response) => setSamples(response.demoInvoices))
      .catch(() => setSamples([]));
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      setBusy('upload');
      setError(null);
      try {
        await api.uploadFile(file);
        onQueued();
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Upload failed.');
      } finally {
        setBusy(null);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [onQueued],
  );

  const runSample = async (slug: string) => {
    setBusy(slug);
    setError(null);
    try {
      await api.useDemoInvoice(slug);
      onQueued();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not add the sample.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="add-invoice" className="rule-t bg-paper-raised">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div>
          <h2 id="add-invoice" className="eyebrow">
            Add an invoice
          </h2>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void handleFiles(event.dataTransfer.files);
            }}
            className={`mt-3 border border-dashed p-6 text-center transition-colors ${
              dragging ? 'border-ledger bg-ledger-wash' : 'border-rule-strong bg-paper'
            }`}
          >
            <FileUp aria-hidden className="mx-auto h-5 w-5 text-ink-faint" />
            <p className="mt-3 text-[14px] leading-snug text-ink-soft">
              Drop a photo or PDF of a supplier bill here.
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy !== null}
              className="mt-4 inline-flex items-center gap-2 bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-paper transition-colors hover:bg-ledger disabled:opacity-50"
            >
              {busy === 'upload' ? (
                <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
              ) : null}
              Choose a file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/tiff,application/pdf"
              className="sr-only"
              onChange={(event) => void handleFiles(event.target.files)}
            />
            <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
              JPG · PNG · PDF · up to 15 MB
            </p>
          </div>

          {error ? (
            <p role="alert" className="mt-3 border-l-2 border-stamp bg-stamp-wash px-3 py-2 text-[13px] text-stamp">
              {error}
            </p>
          ) : null}
        </div>

        <div>
          <h3 className="eyebrow">Sample bills</h3>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-soft">
            Each sample is a real-shaped Bhopal supplier bill that triggers one specific check.
          </p>
          <ul className="mt-4 grid gap-px bg-rule sm:grid-cols-2">
            {samples.map((sample) => (
              <li key={sample.slug} className="bg-paper">
                <button
                  type="button"
                  onClick={() => void runSample(sample.slug)}
                  disabled={busy !== null}
                  className="group h-full w-full px-4 py-3.5 text-left transition-colors hover:bg-bar disabled:opacity-50"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-[13.5px] font-medium text-ink">
                      {sample.headline}
                    </span>
                    {busy === sample.slug ? (
                      <Loader2 aria-hidden className="h-3 w-3 shrink-0 animate-spin text-ink-faint" />
                    ) : null}
                  </span>
                  <span className="mt-1 block text-[12.5px] leading-snug text-ink-faint">
                    {sample.teaches}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

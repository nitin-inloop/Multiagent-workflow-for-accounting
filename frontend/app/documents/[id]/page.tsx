'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2,
  Mail,
  MessageCircle,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import { ReconciliationProof } from '@/components/ReconciliationProof';
import { ConfidenceMeter, StatusChip } from '@/components/StatusChip';
import { TopRail } from '@/components/TopRail';
import { AuditTrail } from '@/components/review/AuditTrail';
import { DocumentPreview } from '@/components/review/DocumentPreview';
import { ExceptionList } from '@/components/review/ExceptionList';
import { ExportRail } from '@/components/review/ExportRail';
import { FieldsEditor } from '@/components/review/FieldsEditor';
import { LineItemsEditor } from '@/components/review/LineItemsEditor';
import { DeclineModal } from '@/components/review/DeclineModal';
import { EmailRequestPanel } from '@/components/review/EmailRequestPanel';
import { ReminderPanel } from '@/components/review/ReminderPanel';
import { api, ApiError, fileUrl } from '@/lib/api';
import { ENGINE_LABELS } from '@/lib/format';
import type {
  EmailNotification,
  InfoRequestResult,
  InvoiceDocument,
  InvoiceFields,
  ReminderDraft,
} from '@/lib/types';

const ACTOR = 'Demo Accountant';

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const documentId = params.id;

  const [document, setDocument] = useState<InvoiceDocument | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [draft, setDraft] = useState<InvoiceFields | null>(null);
  const [reminder, setReminder] = useState<ReminderDraft | null>(null);
  const [infoRequest, setInfoRequest] = useState<InfoRequestResult | null>(null);
  const [declineNotice, setDeclineNotice] = useState<EmailNotification | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // State lands in the promise callbacks rather than in the effect body, so a
  // poll tick never cascades a synchronous re-render.
  const load = useCallback(
    (options?: { keepDraft?: boolean }) =>
      api.getDocument(documentId).then(
        (response) => {
          setDocument(response.document);
          setPreviewSrc(response.previewUrl ?? fileUrl(response.previewPath));
          if (!options?.keepDraft) setDraft(response.document.fields);
          setError(null);
        },
        (caught: unknown) => {
          setError(caught instanceof ApiError ? caught.message : 'Could not load this document.');
        },
      ),
    [documentId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Keep polling while extraction is still running.
  useEffect(() => {
    if (document?.status !== 'PROCESSING') return;
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [document?.status, load]);

  const dirty = useMemo(
    () => Boolean(document && draft && JSON.stringify(document.fields) !== JSON.stringify(draft)),
    [document, draft],
  );

  const blocking = (document?.exceptions ?? []).filter(
    (exception) => exception.severity === 'BLOCKING',
  );

  const apply = async (action: 'SAVE' | 'APPROVE' | 'REJECT', reason?: string) => {
    if (!draft) return;
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const response = await api.review(documentId, {
        action,
        actor: ACTOR,
        reason,
        fields: action === 'REJECT' ? undefined : draft,
      });
      setDocument(response.document);
      setDraft(response.document.fields);
      setNotice(
        action === 'APPROVE'
          ? 'Approved. The entry is ready to export.'
          : action === 'REJECT'
            ? 'Rejected. It will not reach the books.'
            : 'Corrections saved and re-checked.',
      );
      // A rejection pops the vendor-facing notice the moment it lands.
      if (action === 'REJECT' && response.notification) {
        setDeclineNotice(response.notification);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not go through.');
    } finally {
      setBusy(null);
    }
  };

  const drawReminder = async () => {
    setBusy('REMINDER');
    setError(null);
    try {
      const response = await api.reminder(documentId, `${ACTOR}, Nagar Enterprises`);
      setDocument(response.document);
      setReminder(response.reminder);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not draft the reminder.');
    } finally {
      setBusy(null);
    }
  };

  const requestInfo = async () => {
    setBusy('REQUEST_INFO');
    setError(null);
    try {
      const response = await api.requestInfo(documentId, `${ACTOR}, Nagar Enterprises`);
      setDocument(response.document);
      setInfoRequest(response.request);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not email the vendor.');
    } finally {
      setBusy(null);
    }
  };

  const retryExtraction = async () => {
    setBusy('RETRY');
    setError(null);
    try {
      const response = await api.reprocess(documentId);
      setDocument(response.document);
      setDraft(response.document.fields);
      setNotice('Read again from the original file.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not read it again.');
    } finally {
      setBusy(null);
    }
  };

  if (!document || !draft) {
    return (
      <>
        <TopRail crumb="Review" />
        <main className="flex-1">
          <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8">
            {error ? (
              <div role="alert" className="border-l-2 border-stamp bg-stamp-wash px-4 py-3">
                <p className="text-[14px] text-stamp">{error}</p>
                <Link
                  href="/"
                  className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-stamp hover:underline"
                >
                  <ArrowLeft aria-hidden className="h-3 w-3" />
                  Back to the inbox
                </Link>
              </div>
            ) : (
              <p className="text-[14px] text-ink-faint">Opening the document…</p>
            )}
          </div>
        </main>
      </>
    );
  }

  const approved = document.status === 'APPROVED' || document.status === 'EXPORTED';
  const closed = approved || document.status === 'REJECTED';

  return (
    <>
      <TopRail crumb={document.fields.invoiceNumber ?? 'Review'} />

      <main className="flex-1">
        <div className="mx-auto max-w-[1180px] px-5 pt-7 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
          >
            <ArrowLeft aria-hidden className="h-3 w-3" />
            Inbox
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <h1 className="font-display text-[clamp(1.6rem,3.6vw,2.35rem)] font-bold leading-tight tracking-[-0.03em] text-ink">
                {document.fields.vendorName ?? 'Vendor not read'}
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
                <span data-figure>{document.fields.invoiceNumber ?? 'no invoice number'}</span>
                <span aria-hidden className="text-rule-strong">
                  ·
                </span>
                <span data-figure>{document.fields.gstin ?? 'GSTIN missing'}</span>
                <span aria-hidden className="text-rule-strong">
                  ·
                </span>
                <span>{ENGINE_LABELS[document.extractionEngine]}</span>
              </p>
            </div>

            <div className="flex items-center gap-4">
              <ConfidenceMeter value={document.confidence} />
              <StatusChip status={document.status} />
            </div>
          </div>

          {/* The checks speak for themselves below; this line is only the
              model's own remark about how the read went. It describes the
              original extraction, so it is dropped once the entry is settled
              and the corrections have superseded it. */}
          {document.explanation && !closed ? (
            <p className="mt-5 max-w-3xl border-l-2 border-rule-strong pl-3.5 text-[14px] leading-relaxed text-ink-soft">
              <span className="eyebrow mr-2">Read note</span>
              {document.explanation}
            </p>
          ) : null}
        </div>

        {notice ? (
          <div className="mx-auto mt-5 max-w-[1180px] px-5 sm:px-8">
            <p
              role="status"
              className="flex items-center gap-2 border-l-2 border-ledger bg-ledger-wash px-3.5 py-2.5 text-[13.5px] text-ledger"
            >
              <Check aria-hidden className="h-3.5 w-3.5" />
              {notice}
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mx-auto mt-5 max-w-[1180px] px-5 sm:px-8">
            <p
              role="alert"
              className="flex items-start gap-2 border-l-2 border-stamp bg-stamp-wash px-3.5 py-2.5 text-[13.5px] text-stamp"
            >
              <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          </div>
        ) : null}

        <div className="mx-auto mt-7 grid max-w-[1180px] gap-8 px-5 pb-16 sm:px-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          {/* The paper and its history sit together, so the tall right column
              of editable fields has something beside it the whole way down. */}
          <div className="space-y-7">
            {previewSrc ? <DocumentPreview document={document} src={previewSrc} /> : null}
            <AuditTrail events={document.audit} />
          </div>

          <div className="space-y-7">
            <section aria-labelledby="checks">
              <h2 id="checks" className="eyebrow mb-3">
                {document.exceptions.length === 0
                  ? 'Checks'
                  : `${blocking.length} blocking · ${document.exceptions.length - blocking.length} note${
                      document.exceptions.length - blocking.length === 1 ? '' : 's'
                    }`}
              </h2>
              <ExceptionList exceptions={document.exceptions} />
            </section>

            <section aria-labelledby="proof" className="border border-rule bg-paper-raised px-4 py-4">
              <h2 id="proof" className="sr-only">
                Arithmetic check
              </h2>
              <ReconciliationProof fields={draft} size="compact" />
              {dirty ? (
                <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ready">
                  Recalculated from your edits · save to re-run the checks
                </p>
              ) : null}
            </section>

            {/* A settled entry is a record, not a form. */}
            <FieldsEditor
              fields={draft}
              exceptions={document.exceptions}
              onChange={setDraft}
              locked={closed}
            />

            <LineItemsEditor
              items={draft.lineItems}
              onChange={(lineItems) => setDraft({ ...draft, lineItems })}
              locked={closed}
            />

            {reminder ? (
              <ReminderPanel draft={reminder} onClose={() => setReminder(null)} />
            ) : null}

            {infoRequest ? (
              <EmailRequestPanel result={infoRequest} onClose={() => setInfoRequest(null)} />
            ) : null}

            {approved ? (
              <ExportRail
                document={document}
                actor={ACTOR}
                onExported={(next) => setDocument(next)}
              />
            ) : null}

            {/* Actions sit below the sheet, in the order the work happens. */}
            {!closed ? (
              <div className="sticky bottom-0 z-10 border border-rule-strong bg-paper px-4 py-3.5 shadow-[0_-10px_24px_-18px_rgba(16,26,22,0.55)]">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void apply('APPROVE')}
                    disabled={busy !== null || blocking.length > 0}
                    title={
                      blocking.length > 0
                        ? 'Clear the blocking exceptions first, then save.'
                        : undefined
                    }
                    className="inline-flex items-center gap-2 border border-ledger bg-ledger px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition-colors hover:bg-ink hover:border-ink disabled:cursor-not-allowed disabled:border-rule disabled:bg-bar disabled:text-ink-faint"
                  >
                    {busy === 'APPROVE' ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check aria-hidden className="h-3.5 w-3.5" />
                    )}
                    Approve the entry
                  </button>

                  <button
                    type="button"
                    onClick={() => void apply('SAVE')}
                    disabled={busy !== null || !dirty}
                    className="inline-flex items-center gap-2 border border-rule-strong bg-paper-raised px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink transition-colors hover:bg-bar disabled:opacity-45"
                  >
                    {busy === 'SAVE' ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save aria-hidden className="h-3.5 w-3.5" />
                    )}
                    {dirty ? 'Save and re-check' : 'No changes to save'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void drawReminder()}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-2 border border-rule bg-paper px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:text-ink disabled:opacity-45"
                  >
                    {busy === 'REMINDER' ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MessageCircle aria-hidden className="h-3.5 w-3.5" />
                    )}
                    Draft a reminder
                  </button>

                  <button
                    type="button"
                    onClick={() => void requestInfo()}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-2 border border-rule bg-paper px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:text-ink disabled:opacity-45"
                  >
                    {busy === 'REQUEST_INFO' ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mail aria-hidden className="h-3.5 w-3.5" />
                    )}
                    Request missing details
                  </button>

                  <button
                    type="button"
                    onClick={() => void retryExtraction()}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-2 px-2.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint transition-colors hover:text-ink disabled:opacity-45"
                  >
                    {busy === 'RETRY' ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw aria-hidden className="h-3.5 w-3.5" />
                    )}
                    Read it again
                  </button>

                  <button
                    type="button"
                    onClick={() => void apply('REJECT', 'Not a purchase bill for this firm.')}
                    disabled={busy !== null}
                    className="ml-auto inline-flex items-center gap-2 px-2.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint transition-colors hover:text-stamp disabled:opacity-45"
                  >
                    {busy === 'REJECT' ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X aria-hidden className="h-3.5 w-3.5" />
                    )}
                    Reject
                  </button>
                </div>

                {blocking.length > 0 ? (
                  <p className="mt-2.5 text-[12.5px] text-ink-faint">
                    Approval opens once the {blocking.length === 1 ? 'issue' : 'issues'} above{' '}
                    {blocking.length === 1 ? 'is' : 'are'} fixed and saved.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rule-t flex flex-wrap items-center gap-3 pt-4">
                <p className="text-[13.5px] text-ink-soft">
                  {document.status === 'REJECTED'
                    ? 'This document was rejected and will not reach the books.'
                    : 'This entry is locked to what was approved.'}
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-soft hover:text-ink"
                >
                  <ArrowLeft aria-hidden className="h-3 w-3" />
                  Back to the inbox
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {declineNotice ? (
        <DeclineModal notification={declineNotice} onClose={() => setDeclineNotice(null)} />
      ) : null}
    </>
  );
}

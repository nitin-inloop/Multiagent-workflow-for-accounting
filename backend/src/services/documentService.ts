import { randomUUID } from 'node:crypto';
import { config } from '../config/env.js';
import { DEMO_INVOICES, findDemoInvoice, type DemoInvoice } from '../demo/demoInvoices.js';
import { renderDemoInvoiceSvg } from '../demo/renderDemoInvoice.js';
import type { DocumentRepository } from '../repositories/documentRepository.js';
import {
  documentSchema,
  emptyInvoiceFields,
  type AuditEvent,
  type DocumentStatus,
  type InvoiceDocument,
  type InvoiceFields,
  type ReviewRequest,
} from '../types/document.js';
import { nowIso } from '../utils/dates.js';
import { conflict, notFound, unprocessable } from '../utils/errors.js';
import { invoiceFingerprint, sha256 } from '../utils/hash.js';
import { logger } from '../utils/logger.js';
import { normalizeGstin } from '../utils/gstin.js';
import type { EmailResult, EmailService } from './emailService.js';
import type { ExtractionService } from './extractionService.js';
import { documentStorageKey, type StorageService } from './storageService.js';
import {
  buildDeclineEmail,
  buildMissingInfoEmail,
  buildReminderMessage,
  FIELD_LABELS,
  validateInvoice,
} from './validationService.js';

export interface DocumentStats {
  total: number;
  processing: number;
  needsReview: number;
  readyForApproval: number;
  approved: number;
  exported: number;
  rejected: number;
  failed: number;
  /** Share of documents that cleared validation without human edits. */
  straightThroughRate: number;
  /** Rough minutes saved, at three minutes of typing per invoice avoided. */
  minutesSaved: number;
}

const MINUTES_PER_MANUAL_ENTRY = 3;

export class DocumentService {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly storage: StorageService,
    private readonly extraction: ExtractionService,
    private readonly email: EmailService,
  ) {}

  // ---------------------------------------------------------------- creation

  async createFromUpload(input: {
    bytes: Buffer;
    fileName: string;
    mimeType: string;
    source?: InvoiceDocument['source'];
    demoSlug?: string | null;
  }): Promise<InvoiceDocument> {
    const documentId = `doc_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const fileHash = sha256(input.bytes);
    const storageKey = documentStorageKey(config.orgId, documentId, input.fileName);

    await this.storage.put(storageKey, input.bytes, input.mimeType);

    const identicalUploads = await this.repository.findByFileHash(config.orgId, fileHash);
    const at = nowIso();

    const document = documentSchema.parse({
      documentId,
      orgId: config.orgId,
      status: 'PROCESSING' satisfies DocumentStatus,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.bytes.byteLength,
      fileHash,
      fingerprint: null,
      storageKey,
      source: input.source ?? 'UPLOAD',
      extractionEngine: 'NONE',
      fields: emptyInvoiceFields(),
      confidence: null,
      exceptions: [],
      reviewNote: 'Reading the document.',
      explanation: null,
      audit: [
        {
          at,
          actor: 'LedgerFlow',
          action: 'UPLOADED',
          detail: `${input.fileName} received via ${input.source ?? 'UPLOAD'}${
            identicalUploads.length > 0 ? ' (identical file already in the inbox)' : ''
          }`,
        },
      ],
      createdAt: at,
      updatedAt: at,
    });

    await this.repository.put(document);
    logger.info('Document created', { documentId, fileHash: fileHash.slice(0, 12) });

    // The caller decides when to run extraction so the API can answer at once.
    return document;
  }

  /** Uploads one of the built-in samples, rendering its SVG as the stored file. */
  async createFromDemo(slug: string): Promise<InvoiceDocument> {
    const demo = findDemoInvoice(slug);
    if (!demo) throw notFound(`Unknown demo invoice "${slug}"`);
    return this.createFromUpload({
      bytes: renderDemoInvoiceSvg(demo),
      fileName: demo.fileName.replace(/\.jpg$/, '.svg'),
      mimeType: 'image/svg+xml',
      source: 'DEMO',
      demoSlug: demo.slug,
    });
  }

  // -------------------------------------------------------------- processing

  /**
   * Runs extraction and validation for a document. Safe to call again: it
   * re-reads the stored file and overwrites the extracted fields, which is what
   * the "retry extraction" button needs.
   */
  async process(documentId: string, demoSlug?: string | null): Promise<InvoiceDocument> {
    const existing = await this.require(documentId);

    if (existing.status === 'APPROVED' || existing.status === 'EXPORTED') {
      throw conflict('This document is already approved and cannot be re-extracted.');
    }

    const bytes = await this.storage.get(existing.storageKey);
    const slug = demoSlug ?? (existing.source === 'DEMO' ? this.demoSlugFor(existing) : null);

    const outcome = await this.extraction.extract({
      bytes,
      mimeType: existing.mimeType,
      fileHash: existing.fileHash,
      demoSlug: slug,
    });

    const fields = normalizeFields(outcome.fields);
    const fingerprint = invoiceFingerprint({
      gstin: fields.gstin,
      vendorName: fields.vendorName,
      invoiceNumber: fields.invoiceNumber,
    });

    const duplicateOfDocumentId = fingerprint
      ? await this.findDuplicate(documentId, fingerprint)
      : null;

    const validation = validateInvoice({
      fields,
      confidence: outcome.confidence,
      duplicateOfDocumentId,
      extractionFailed: outcome.failed,
    });

    const audit: AuditEvent[] = [
      ...existing.audit,
      {
        at: nowIso(),
        actor: 'LedgerFlow',
        action: 'EXTRACTED',
        detail: `${engineLabel(outcome.engine)} read ${countPopulated(fields)} fields at ${(
          outcome.confidence * 100
        ).toFixed(0)}% confidence. ${validation.exceptions.length} exception(s) raised.`,
      },
      ...outcome.notes.map((note) => ({
        at: nowIso(),
        actor: 'LedgerFlow',
        action: 'NOTE',
        detail: note,
      })),
    ];

    const updated: InvoiceDocument = {
      ...existing,
      status: validation.requiresReview ? 'NEEDS_REVIEW' : 'READY_FOR_APPROVAL',
      extractionEngine: outcome.engine,
      fields,
      fingerprint,
      confidence: outcome.confidence,
      exceptions: validation.exceptions,
      reviewNote: validation.reviewNote,
      explanation: outcome.explanation,
      audit,
      updatedAt: nowIso(),
    };

    await this.repository.put(updated);
    logger.info('Document processed', {
      documentId,
      status: updated.status,
      engine: outcome.engine,
      exceptions: validation.exceptions.length,
    });
    return updated;
  }

  /** Fire-and-forget processing used right after an upload. */
  processInBackground(documentId: string, demoSlug?: string | null): void {
    void this.process(documentId, demoSlug).catch(async (error: unknown) => {
      logger.error('Background processing failed', {
        documentId,
        error: (error as Error).message,
      });
      const existing = await this.repository.get(config.orgId, documentId);
      if (!existing) return;
      await this.repository.put({
        ...existing,
        status: 'FAILED',
        reviewNote: `Processing failed: ${(error as Error).message}`,
        audit: [
          ...existing.audit,
          {
            at: nowIso(),
            actor: 'LedgerFlow',
            action: 'FAILED',
            detail: (error as Error).message,
          },
        ],
        updatedAt: nowIso(),
      });
    });
  }

  // ------------------------------------------------------------------ reads

  async get(documentId: string): Promise<InvoiceDocument | null> {
    return this.repository.get(config.orgId, documentId);
  }

  async require(documentId: string): Promise<InvoiceDocument> {
    const document = await this.get(documentId);
    if (!document) throw notFound(`Document ${documentId} was not found.`);
    return document;
  }

  async list(status?: DocumentStatus): Promise<InvoiceDocument[]> {
    return this.repository.list({ orgId: config.orgId, status });
  }

  async stats(): Promise<DocumentStats> {
    const documents = await this.repository.list({ orgId: config.orgId });
    const count = (status: DocumentStatus): number =>
      documents.filter((document) => document.status === status).length;

    const settled = documents.filter((document) => document.status !== 'PROCESSING');
    const cleared = documents.filter(
      (document) => document.exceptions.filter((e) => e.severity === 'BLOCKING').length === 0,
    ).length;

    return {
      total: documents.length,
      processing: count('PROCESSING'),
      needsReview: count('NEEDS_REVIEW'),
      readyForApproval: count('READY_FOR_APPROVAL'),
      approved: count('APPROVED'),
      exported: count('EXPORTED'),
      rejected: count('REJECTED'),
      failed: count('FAILED'),
      straightThroughRate: settled.length === 0 ? 0 : Number((cleared / settled.length).toFixed(3)),
      minutesSaved: documents.length * MINUTES_PER_MANUAL_ENTRY,
    };
  }

  async previewUrl(documentId: string): Promise<{ url: string | null; document: InvoiceDocument }> {
    const document = await this.require(documentId);
    return { url: await this.storage.previewUrl(document.storageKey), document };
  }

  async fileBytes(documentId: string): Promise<{ bytes: Buffer; document: InvoiceDocument }> {
    const document = await this.require(documentId);
    return { bytes: await this.storage.get(document.storageKey), document };
  }

  // ----------------------------------------------------------------- review

  /**
   * Applies accountant corrections, re-runs validation on the corrected data,
   * and records the action. Approval is refused while a blocking exception is
   * unresolved, so nothing unvalidated can reach an export. A rejection also
   * emails the vendor a decline notice and reports it back to the UI.
   */
  async review(
    documentId: string,
    request: ReviewRequest,
  ): Promise<{ document: InvoiceDocument; notification: EmailResult | null }> {
    const existing = await this.require(documentId);

    if (existing.status === 'EXPORTED') {
      throw conflict('This document was already exported and is locked.');
    }
    if (existing.status === 'PROCESSING') {
      throw conflict('Extraction is still running for this document.');
    }

    if (request.action === 'REJECT') {
      const notification = await this.email.send(
        buildDeclineEmail({
          vendorName: existing.fields.vendorName,
          invoiceNumber: existing.fields.invoiceNumber,
          reason: request.reason ?? null,
          senderName: request.actor,
        }),
      );

      const rejected: InvoiceDocument = {
        ...existing,
        status: 'REJECTED',
        reviewNote: request.reason ?? 'Rejected by reviewer.',
        audit: [
          ...existing.audit,
          {
            at: nowIso(),
            actor: request.actor,
            action: 'REJECTED',
            detail: request.reason ?? null,
          },
          {
            at: nowIso(),
            actor: 'LedgerFlow',
            action: 'DECLINE_EMAILED',
            detail: notification.delivered
              ? `Decline notice emailed to ${notification.to}.`
              : `Decline notice recorded for ${notification.to} (SMTP not configured, so nothing was delivered).`,
          },
        ],
        updatedAt: nowIso(),
      };
      await this.repository.put(rejected);
      return { document: rejected, notification };
    }

    const changes = request.fields ?? {};
    const merged = normalizeFields({
      ...existing.fields,
      ...changes,
      tax: { ...existing.fields.tax, ...(changes.tax ?? {}) },
      lineItems: changes.lineItems ?? existing.fields.lineItems,
    });

    const changedFields = describeChanges(existing.fields, merged);

    const fingerprint = invoiceFingerprint({
      gstin: merged.gstin,
      vendorName: merged.vendorName,
      invoiceNumber: merged.invoiceNumber,
    });
    const duplicateOfDocumentId = fingerprint
      ? await this.findDuplicate(documentId, fingerprint)
      : null;

    const validation = validateInvoice({
      fields: merged,
      confidence: existing.confidence,
      duplicateOfDocumentId,
    });

    const audit: AuditEvent[] = [...existing.audit];
    if (changedFields.length > 0) {
      audit.push({
        at: nowIso(),
        actor: request.actor,
        action: 'CORRECTED',
        detail: changedFields.join('; '),
      });
    }

    if (request.action === 'APPROVE' && validation.requiresReview) {
      throw unprocessable('Cannot approve while blocking exceptions remain.', {
        exceptions: validation.exceptions.filter((e) => e.severity === 'BLOCKING'),
      });
    }

    const approving = request.action === 'APPROVE';
    if (approving) {
      audit.push({
        at: nowIso(),
        actor: request.actor,
        action: 'APPROVED',
        detail: `Approved with ${validation.exceptions.length} remaining note(s).`,
      });
    } else if (changedFields.length === 0) {
      audit.push({
        at: nowIso(),
        actor: request.actor,
        action: 'REVIEWED',
        detail: 'Opened and saved with no changes.',
      });
    }

    const updated: InvoiceDocument = {
      ...existing,
      status: approving ? 'APPROVED' : validation.requiresReview ? 'NEEDS_REVIEW' : 'READY_FOR_APPROVAL',
      fields: merged,
      fingerprint,
      exceptions: validation.exceptions,
      reviewNote: approving
        ? `Approved by ${request.actor}. ${validation.reviewNote}`
        : validation.reviewNote,
      audit,
      approvedAt: approving ? nowIso() : existing.approvedAt,
      updatedAt: nowIso(),
    };

    await this.repository.put(updated);
    logger.info('Document reviewed', {
      documentId,
      action: request.action,
      status: updated.status,
    });
    return { document: updated, notification: null };
  }

  // ----------------------------------------------------------------- export

  /** Records the export in the audit trail and moves the document to EXPORTED. */
  async markExported(
    documentId: string,
    format: 'CSV' | 'TALLY_XML',
    actor: string,
  ): Promise<InvoiceDocument> {
    const existing = await this.require(documentId);
    if (existing.status !== 'APPROVED' && existing.status !== 'EXPORTED') {
      throw unprocessable(
        `Only approved documents can be exported. This one is ${existing.status}.`,
      );
    }

    const at = nowIso();
    const updated: InvoiceDocument = {
      ...existing,
      status: 'EXPORTED',
      audit: [
        ...existing.audit,
        {
          at,
          actor,
          action: 'EXPORTED',
          detail: format === 'CSV' ? 'Accounting CSV downloaded.' : 'Tally XML voucher downloaded.',
        },
      ],
      exportedAt: existing.exportedAt ?? at,
      updatedAt: at,
    };
    await this.repository.put(updated);
    return updated;
  }

  // --------------------------------------------------------------- reminder

  async reminder(documentId: string, senderName: string): Promise<{
    message: string;
    missingFields: string[];
    document: InvoiceDocument;
  }> {
    const existing = await this.require(documentId);
    const validation = validateInvoice({
      fields: existing.fields,
      confidence: existing.confidence,
    });

    const message = buildReminderMessage({
      vendorName: existing.fields.vendorName,
      invoiceNumber: existing.fields.invoiceNumber,
      missingFields: validation.missingFields,
      senderName,
    });

    const updated: InvoiceDocument = {
      ...existing,
      audit: [
        ...existing.audit,
        {
          at: nowIso(),
          actor: senderName,
          action: 'REMINDER_DRAFTED',
          detail:
            validation.missingFields.length > 0
              ? `Draft asks the vendor for: ${validation.missingFields.join(', ')}.`
              : 'Draft asks the vendor for a clearer copy.',
        },
      ],
      updatedAt: nowIso(),
    };
    await this.repository.put(updated);

    return { message, missingFields: validation.missingFields, document: updated };
  }

  /**
   * Emails the vendor asking them to send the credentials extraction could
   * not read (GSTIN, invoice number, and so on). The decline email in
   * review() covers rejected invoices; this covers the chase while the
   * entry is still open.
   */
  async requestMissingInfo(documentId: string, senderName: string): Promise<{
    document: InvoiceDocument;
    email: EmailResult;
    missingFields: string[];
  }> {
    const existing = await this.require(documentId);
    const validation = validateInvoice({
      fields: existing.fields,
      confidence: existing.confidence,
    });

    const email = await this.email.send(
      buildMissingInfoEmail({
        vendorName: existing.fields.vendorName,
        invoiceNumber: existing.fields.invoiceNumber,
        missingFields: validation.missingFields,
        senderName,
      }),
    );

    const asked =
      validation.missingFields.length > 0
        ? validation.missingFields.map((field) => FIELD_LABELS[field] ?? field).join(', ')
        : 'a clearer copy of the document';

    const updated: InvoiceDocument = {
      ...existing,
      audit: [
        ...existing.audit,
        {
          at: nowIso(),
          actor: senderName,
          action: 'INFO_REQUESTED',
          detail: email.delivered
            ? `Emailed ${email.to} asking for: ${asked}.`
            : `Email recorded for ${email.to} asking for: ${asked} (SMTP not configured).`,
        },
      ],
      updatedAt: nowIso(),
    };
    await this.repository.put(updated);

    return { document: updated, email, missingFields: validation.missingFields };
  }

  // ---------------------------------------------------------------- helpers

  /** Demo samples available in the upload panel. */
  demoCatalogue(): Array<Pick<DemoInvoice, 'slug' | 'headline' | 'teaches' | 'fileName'>> {
    return DEMO_INVOICES.map(({ slug, headline, teaches, fileName }) => ({
      slug,
      headline,
      teaches,
      fileName,
    }));
  }

  private demoSlugFor(document: InvoiceDocument): string | null {
    const match = DEMO_INVOICES.find(
      (demo) => demo.fileName.replace(/\.[a-z]+$/, '') === document.fileName.replace(/\.[a-z]+$/, ''),
    );
    return match?.slug ?? null;
  }

  /** Earliest other document sharing this vendor + invoice number. */
  private async findDuplicate(documentId: string, fingerprint: string): Promise<string | null> {
    const matches = await this.repository.findByFingerprint(config.orgId, fingerprint);
    const others = matches
      .filter((doc) => doc.documentId !== documentId && doc.status !== 'REJECTED')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return others[0]?.documentId ?? null;
  }
}

/** Trims strings, uppercases the GSTIN, and drops empty line items. */
function normalizeFields(fields: InvoiceFields): InvoiceFields {
  const trim = (value: string | null): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.replace(/\s+/g, ' ').trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return {
    ...fields,
    vendorName: trim(fields.vendorName),
    gstin: normalizeGstin(fields.gstin),
    invoiceNumber: trim(fields.invoiceNumber),
    invoiceDate: trim(fields.invoiceDate),
    placeOfSupply: trim(fields.placeOfSupply),
    lineItems: fields.lineItems
      .filter(
        (item) =>
          (item.name ?? '').trim().length > 0 ||
          item.amount !== null ||
          item.quantity !== null ||
          item.rate !== null,
      )
      .map((item) => ({
        ...item,
        name: (item.name ?? '').trim().length > 0 ? item.name.trim() : 'Unlabelled item',
        hsn: trim(item.hsn),
      })),
  };
}

function describeChanges(before: InvoiceFields, after: InvoiceFields): string[] {
  const changes: string[] = [];
  const compare = (label: string, a: unknown, b: unknown): void => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes.push(`${label}: ${display(a)} -> ${display(b)}`);
    }
  };

  compare('vendorName', before.vendorName, after.vendorName);
  compare('gstin', before.gstin, after.gstin);
  compare('invoiceNumber', before.invoiceNumber, after.invoiceNumber);
  compare('invoiceDate', before.invoiceDate, after.invoiceDate);
  compare('placeOfSupply', before.placeOfSupply, after.placeOfSupply);
  compare('subTotal', before.subTotal, after.subTotal);
  compare('cgst', before.tax.cgst, after.tax.cgst);
  compare('sgst', before.tax.sgst, after.tax.sgst);
  compare('igst', before.tax.igst, after.tax.igst);
  compare('total', before.total, after.total);
  if (JSON.stringify(before.lineItems) !== JSON.stringify(after.lineItems)) {
    changes.push(`lineItems: ${before.lineItems.length} row(s) -> ${after.lineItems.length} row(s)`);
  }
  return changes;
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'empty';
  return String(value);
}

function countPopulated(fields: InvoiceFields): number {
  const values = [
    fields.vendorName,
    fields.gstin,
    fields.invoiceNumber,
    fields.invoiceDate,
    fields.placeOfSupply,
    fields.subTotal,
    fields.tax.cgst,
    fields.tax.sgst,
    fields.tax.igst,
    fields.total,
  ];
  return values.filter((value) => value !== null && value !== undefined).length +
    fields.lineItems.length;
}

function engineLabel(engine: InvoiceDocument['extractionEngine']): string {
  switch (engine) {
    case 'TEXTRACT_GEMINI':
      return 'Textract + Gemini';
    case 'TEXTRACT':
      return 'Textract';
    case 'GEMINI_VISION':
      return 'Gemini vision';
    case 'DEMO_FALLBACK':
      return 'Sample extraction';
    default:
      return 'Extraction';
  }
}

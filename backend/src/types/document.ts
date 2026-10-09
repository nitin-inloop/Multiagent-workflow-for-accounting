import { z } from 'zod';

/**
 * Document lifecycle. A document only ever moves forward through these states,
 * except REJECTED which is terminal, and NEEDS_REVIEW which a correction can
 * push back to READY_FOR_APPROVAL.
 */
export const DOCUMENT_STATUSES = [
  'PROCESSING',
  'NEEDS_REVIEW',
  'READY_FOR_APPROVAL',
  'APPROVED',
  'EXPORTED',
  'REJECTED',
  'FAILED',
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);

/** Machine-readable exception codes. The UI maps these to labels and hints. */
export const EXCEPTION_CODES = [
  'GSTIN_MISSING',
  'GSTIN_INVALID',
  'VENDOR_MISSING',
  'INVOICE_NUMBER_MISSING',
  'INVOICE_DATE_MISSING',
  'INVOICE_DATE_FUTURE',
  'LINE_ITEMS_MISSING',
  'TOTAL_MISSING',
  'TOTAL_MISMATCH',
  'TAX_MISMATCH',
  'TAX_SPLIT_INVALID',
  'DUPLICATE_INVOICE',
  'LOW_CONFIDENCE',
  'SIGNATURE_MISSING',
  'EXTRACTION_FAILED',
] as const;

export type ExceptionCode = (typeof EXCEPTION_CODES)[number];

export const exceptionSeveritySchema = z.enum(['BLOCKING', 'WARNING']);
export type ExceptionSeverity = z.infer<typeof exceptionSeveritySchema>;

export const exceptionSchema = z.object({
  code: z.enum(EXCEPTION_CODES),
  severity: exceptionSeveritySchema,
  /** Human sentence shown in the review queue. */
  message: z.string(),
  /** Field path the accountant should look at, when there is one. */
  field: z.string().nullable().default(null),
});

export type InvoiceException = z.infer<typeof exceptionSchema>;

export const lineItemSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable().default(null),
  rate: z.number().nullable().default(null),
  amount: z.number().nullable().default(null),
  hsn: z.string().nullable().default(null),
});

export type LineItem = z.infer<typeof lineItemSchema>;

export const taxSchema = z.object({
  cgst: z.number().nullable().default(null),
  sgst: z.number().nullable().default(null),
  igst: z.number().nullable().default(null),
});

export type TaxBreakdown = z.infer<typeof taxSchema>;

/**
 * The normalized invoice. Every field is nullable on purpose: an uncertain
 * field must be null and raised as an exception, never guessed.
 */
export const invoiceFieldsSchema = z.object({
  vendorName: z.string().nullable().default(null),
  gstin: z.string().nullable().default(null),
  invoiceNumber: z.string().nullable().default(null),
  invoiceDate: z.string().nullable().default(null),
  placeOfSupply: z.string().nullable().default(null),
  currency: z.string().default('INR'),
  lineItems: z.array(lineItemSchema).default([]),
  subTotal: z.number().nullable().default(null),
  tax: taxSchema.default({ cgst: null, sgst: null, igst: null }),
  total: z.number().nullable().default(null),
  hasSignature: z.boolean().nullable().default(null),
});

export type InvoiceFields = z.infer<typeof invoiceFieldsSchema>;

export const auditEventSchema = z.object({
  at: z.string(),
  actor: z.string(),
  action: z.string(),
  detail: z.string().nullable().default(null),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export const documentSchema = z.object({
  documentId: z.string(),
  orgId: z.string(),
  status: documentStatusSchema,
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number(),
  fileHash: z.string(),
  /** Hash of vendor + invoice number, used for accounting-level duplicates. */
  fingerprint: z.string().nullable().default(null),
  storageKey: z.string(),
  source: z.enum(['UPLOAD', 'DEMO', 'WHATSAPP', 'GMAIL', 'DRIVE']).default('UPLOAD'),
  extractionEngine: z
    .enum(['TEXTRACT_GEMINI', 'TEXTRACT', 'GEMINI_VISION', 'DEMO_FALLBACK', 'NONE'])
    .default('NONE'),
  fields: invoiceFieldsSchema,
  confidence: z.number().min(0).max(1).nullable().default(null),
  exceptions: z.array(exceptionSchema).default([]),
  /** Deterministic summary of what a human needs to do. Never model-written. */
  reviewNote: z.string().nullable().default(null),
  /** The model's own remark about the extraction, kept separate from the checks. */
  explanation: z.string().nullable().default(null),
  audit: z.array(auditEventSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  approvedAt: z.string().nullable().default(null),
  exportedAt: z.string().nullable().default(null),
});

export type InvoiceDocument = z.infer<typeof documentSchema>;

/** Payload accepted by PATCH /api/documents/:id/review. */
export const reviewRequestSchema = z.object({
  action: z.enum(['SAVE', 'APPROVE', 'REJECT']),
  actor: z.string().min(1).default('Demo Accountant'),
  reason: z.string().max(500).optional(),
  fields: invoiceFieldsSchema.partial().optional(),
});

export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

export const emptyInvoiceFields = (): InvoiceFields => invoiceFieldsSchema.parse({});

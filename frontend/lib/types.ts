/** Mirrors the API contract in backend/src/types/document.ts. */

export type DocumentStatus =
  | 'PROCESSING'
  | 'NEEDS_REVIEW'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'EXPORTED'
  | 'REJECTED'
  | 'FAILED';

export type ExceptionSeverity = 'BLOCKING' | 'WARNING';

export interface InvoiceException {
  code: string;
  severity: ExceptionSeverity;
  message: string;
  field: string | null;
}

export interface LineItem {
  name: string;
  quantity: number | null;
  rate: number | null;
  amount: number | null;
  hsn: string | null;
}

export interface TaxBreakdown {
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
}

export interface InvoiceFields {
  vendorName: string | null;
  gstin: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  placeOfSupply: string | null;
  currency: string;
  lineItems: LineItem[];
  subTotal: number | null;
  tax: TaxBreakdown;
  total: number | null;
  hasSignature: boolean | null;
}

export interface AuditEvent {
  at: string;
  actor: string;
  action: string;
  detail: string | null;
}

export interface InvoiceDocument {
  documentId: string;
  orgId: string;
  status: DocumentStatus;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  fingerprint: string | null;
  storageKey: string;
  source: 'UPLOAD' | 'DEMO' | 'WHATSAPP' | 'GMAIL' | 'DRIVE';
  extractionEngine: 'TEXTRACT_GEMINI' | 'TEXTRACT' | 'GEMINI_VISION' | 'DEMO_FALLBACK' | 'NONE';
  fields: InvoiceFields;
  confidence: number | null;
  exceptions: InvoiceException[];
  reviewNote: string | null;
  explanation: string | null;
  audit: AuditEvent[];
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  exportedAt: string | null;
}

export interface DocumentStats {
  total: number;
  processing: number;
  needsReview: number;
  readyForApproval: number;
  approved: number;
  exported: number;
  rejected: number;
  failed: number;
  straightThroughRate: number;
  minutesSaved: number;
}

export interface DemoInvoiceSummary {
  slug: string;
  headline: string;
  teaches: string;
  fileName: string;
}

export interface ExportArtifact {
  format: 'CSV' | 'TALLY_XML';
  fileName: string;
  contentType: string;
  body: string;
}

export interface ReminderDraft {
  channel: string;
  message: string;
  missingFields: string[];
  note: string;
}

/** A vendor-facing email the backend sent (or simulated without SMTP). */
export interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  delivered: boolean;
  mode: 'SMTP' | 'SIMULATED';
  error: string | null;
}

export interface InfoRequestResult {
  email: EmailNotification;
  missingFields: string[];
  note: string;
}

export interface ReviewPayload {
  action: 'SAVE' | 'APPROVE' | 'REJECT';
  actor?: string;
  reason?: string;
  fields?: Partial<InvoiceFields>;
}

export interface HealthReport {
  status: string;
  service: string;
  region: string;
  adapters: {
    repository: string;
    storage: string;
    textract: boolean;
    gemini: string | false;
    email: string | false;
  };
}

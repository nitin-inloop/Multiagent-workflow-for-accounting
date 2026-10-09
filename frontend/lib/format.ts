import type { DocumentStatus, InvoiceFields } from './types';

const INR = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Figures without the currency glyph, so columns stay aligned. */
export function figure(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return INR.format(value);
}

export function rupees(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `₹${INR.format(value)}`;
}

export function signedFigure(value: number): string {
  const sign = value < 0 ? '−' : '+';
  return `${sign}${INR.format(Math.abs(value))}`;
}

export function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function clockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export interface StatusMeta {
  label: string;
  /** Tailwind classes for the chip. */
  chip: string;
  dot: string;
}

export const STATUS_META: Record<DocumentStatus, StatusMeta> = {
  PROCESSING: {
    label: 'Reading',
    chip: 'bg-paper-raised text-ink-soft border-rule',
    dot: 'bg-ink-faint',
  },
  NEEDS_REVIEW: {
    label: 'Needs review',
    chip: 'bg-stamp-wash text-stamp border-stamp/30',
    dot: 'bg-stamp',
  },
  READY_FOR_APPROVAL: {
    label: 'Ready',
    chip: 'bg-ready-wash text-ready border-ready/25',
    dot: 'bg-ready',
  },
  APPROVED: {
    label: 'Approved',
    chip: 'bg-ledger-wash text-ledger border-ledger/25',
    dot: 'bg-ledger',
  },
  EXPORTED: {
    label: 'Exported',
    chip: 'bg-ledger text-white border-ledger',
    dot: 'bg-white',
  },
  REJECTED: {
    label: 'Rejected',
    chip: 'bg-paper-raised text-ink-faint border-rule line-through',
    dot: 'bg-ink-faint',
  },
  FAILED: {
    label: 'Failed',
    chip: 'bg-ochre-wash text-ochre border-ochre/30',
    dot: 'bg-ochre',
  },
};

/** Short human labels for exception codes, used in the ledger row. */
export const EXCEPTION_LABELS: Record<string, string> = {
  GSTIN_MISSING: 'GSTIN missing',
  GSTIN_INVALID: 'GSTIN invalid',
  VENDOR_MISSING: 'Vendor missing',
  INVOICE_NUMBER_MISSING: 'No invoice no.',
  INVOICE_DATE_MISSING: 'No date',
  INVOICE_DATE_FUTURE: 'Future date',
  LINE_ITEMS_MISSING: 'No line items',
  TOTAL_MISSING: 'No total',
  TOTAL_MISMATCH: 'Total mismatch',
  TAX_MISMATCH: 'Tax mismatch',
  TAX_SPLIT_INVALID: 'Tax split',
  DUPLICATE_INVOICE: 'Duplicate',
  LOW_CONFIDENCE: 'Low confidence',
  SIGNATURE_MISSING: 'Unsigned',
  EXTRACTION_FAILED: 'Unreadable',
};

export function exceptionLabel(code: string): string {
  return EXCEPTION_LABELS[code] ?? code.replace(/_/g, ' ').toLowerCase();
}

export const ENGINE_LABELS: Record<string, string> = {
  TEXTRACT_GEMINI: 'Textract + Gemini',
  TEXTRACT: 'Textract',
  GEMINI_VISION: 'Gemini vision',
  DEMO_FALLBACK: 'Sample extraction',
  NONE: 'Not extracted',
};

/** Taxable value, falling back to the sum of the line items. */
export function taxableValue(fields: InvoiceFields): number | null {
  if (typeof fields.subTotal === 'number') return fields.subTotal;
  const amounts = fields.lineItems.map((item) =>
    typeof item.amount === 'number'
      ? item.amount
      : typeof item.quantity === 'number' && typeof item.rate === 'number'
        ? item.quantity * item.rate
        : null,
  );
  const present = amounts.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return round2(present.reduce((a, b) => a + b, 0));
}

export function taxTotal(fields: InvoiceFields): number {
  return round2((fields.tax.cgst ?? 0) + (fields.tax.sgst ?? 0) + (fields.tax.igst ?? 0));
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Triage order. A wrong amount puts wrong money into the books, so arithmetic
 * failures outrank everything; a duplicate is already caught by its number and
 * costs nothing but a glance. Ranks below 100 are things a person must fix.
 */
const EXCEPTION_RANK: Record<string, number> = {
  TOTAL_MISMATCH: 10,
  TAX_MISMATCH: 12,
  TAX_SPLIT_INVALID: 20,
  GSTIN_INVALID: 30,
  GSTIN_MISSING: 32,
  EXTRACTION_FAILED: 34,
  TOTAL_MISSING: 36,
  INVOICE_NUMBER_MISSING: 40,
  INVOICE_DATE_MISSING: 42,
  VENDOR_MISSING: 44,
  DUPLICATE_INVOICE: 60,
  LOW_CONFIDENCE: 120,
  SIGNATURE_MISSING: 130,
  LINE_ITEMS_MISSING: 140,
  INVOICE_DATE_FUTURE: 150,
};

export function triageRank(document: { exceptions: InvoiceExceptionLike[] }): number {
  if (document.exceptions.length === 0) return 999;
  return Math.min(...document.exceptions.map((e) => EXCEPTION_RANK[e.code] ?? 90));
}

interface InvoiceExceptionLike {
  code: string;
}

import {
  type ExceptionCode,
  type InvoiceException,
  type InvoiceFields,
} from '../types/document.js';
import { GST_STATE_NAMES, validateGstin } from '../utils/gstin.js';
import { isFutureDate } from '../utils/dates.js';
import { formatInr, nearlyEqual, roundTo2, sumNullable } from '../utils/money.js';

/**
 * Deterministic validation. The AI layer never decides whether an invoice is
 * acceptable: this module does, using arithmetic and format rules only.
 */

export const LOW_CONFIDENCE_THRESHOLD = 0.75;

export interface ValidationInput {
  fields: InvoiceFields;
  confidence: number | null;
  /** Set when another document already claims this vendor + invoice number. */
  duplicateOfDocumentId?: string | null;
  /** Whether the underlying extraction step failed outright. */
  extractionFailed?: boolean;
}

export interface ValidationResult {
  exceptions: InvoiceException[];
  /** BLOCKING exceptions force NEEDS_REVIEW; warnings alone do not. */
  requiresReview: boolean;
  reviewNote: string;
  /** Field names the accountant must fill in, for the reminder message. */
  missingFields: string[];
}

const SEVERITY: Record<ExceptionCode, 'BLOCKING' | 'WARNING'> = {
  GSTIN_MISSING: 'BLOCKING',
  GSTIN_INVALID: 'BLOCKING',
  VENDOR_MISSING: 'BLOCKING',
  INVOICE_NUMBER_MISSING: 'BLOCKING',
  INVOICE_DATE_MISSING: 'BLOCKING',
  INVOICE_DATE_FUTURE: 'WARNING',
  LINE_ITEMS_MISSING: 'WARNING',
  TOTAL_MISSING: 'BLOCKING',
  TOTAL_MISMATCH: 'BLOCKING',
  TAX_MISMATCH: 'BLOCKING',
  TAX_SPLIT_INVALID: 'WARNING',
  DUPLICATE_INVOICE: 'BLOCKING',
  LOW_CONFIDENCE: 'WARNING',
  SIGNATURE_MISSING: 'WARNING',
  EXTRACTION_FAILED: 'BLOCKING',
};

/** Labels used in reminder messages and the review UI. */
export const FIELD_LABELS: Record<string, string> = {
  vendorName: 'vendor name',
  gstin: 'GSTIN',
  invoiceNumber: 'invoice number',
  invoiceDate: 'invoice date',
  lineItems: 'line items',
  subTotal: 'taxable value',
  'tax.cgst': 'CGST',
  'tax.sgst': 'SGST',
  'tax.igst': 'IGST',
  total: 'invoice total',
  hasSignature: 'authorised signature',
};

function raise(
  list: InvoiceException[],
  code: ExceptionCode,
  message: string,
  field: string | null = null,
): void {
  list.push({ code, severity: SEVERITY[code], message, field });
}

export function validateInvoice(input: ValidationInput): ValidationResult {
  const { fields } = input;
  const exceptions: InvoiceException[] = [];
  const missingFields: string[] = [];

  if (input.extractionFailed) {
    raise(
      exceptions,
      'EXTRACTION_FAILED',
      'Automatic extraction could not read this document. Enter the fields manually or re-upload a clearer image.',
    );
  }

  // --- Required identity fields -------------------------------------------
  if (!fields.vendorName || fields.vendorName.trim().length < 2) {
    raise(exceptions, 'VENDOR_MISSING', 'Vendor name was not found on the document.', 'vendorName');
    missingFields.push('vendorName');
  }

  const gstinCheck = validateGstin(fields.gstin);
  if (!gstinCheck.ok) {
    if (gstinCheck.reason === 'MISSING') {
      raise(exceptions, 'GSTIN_MISSING', 'Vendor GSTIN is missing. GST input credit cannot be claimed without it.', 'gstin');
      missingFields.push('gstin');
    } else {
      const detail =
        gstinCheck.reason === 'CHECKSUM'
          ? 'the check digit does not match'
          : gstinCheck.reason === 'STATE_CODE'
            ? 'the state code is not a valid GST state'
            : 'the format is not a valid 15-character GSTIN';
      raise(
        exceptions,
        'GSTIN_INVALID',
        `GSTIN "${fields.gstin}" failed validation because ${detail}.`,
        'gstin',
      );
    }
  }

  if (!fields.invoiceNumber || fields.invoiceNumber.trim().length === 0) {
    raise(exceptions, 'INVOICE_NUMBER_MISSING', 'Invoice number is missing.', 'invoiceNumber');
    missingFields.push('invoiceNumber');
  }

  if (!fields.invoiceDate) {
    raise(exceptions, 'INVOICE_DATE_MISSING', 'Invoice date is missing or unreadable.', 'invoiceDate');
    missingFields.push('invoiceDate');
  } else if (isFutureDate(fields.invoiceDate)) {
    raise(
      exceptions,
      'INVOICE_DATE_FUTURE',
      `Invoice date ${fields.invoiceDate} is in the future. Check the scan for a misread year.`,
      'invoiceDate',
    );
  }

  if (fields.lineItems.length === 0) {
    raise(
      exceptions,
      'LINE_ITEMS_MISSING',
      'No line items were detected, so quantities cannot be cross-checked.',
      'lineItems',
    );
  }

  // --- Arithmetic ----------------------------------------------------------
  const taxTotal = sumNullable([fields.tax.cgst, fields.tax.sgst, fields.tax.igst]) ?? 0;
  const lineItemsTotal = sumNullable(
    fields.lineItems.map((item) => {
      if (typeof item.amount === 'number') return item.amount;
      if (typeof item.quantity === 'number' && typeof item.rate === 'number') {
        return roundTo2(item.quantity * item.rate);
      }
      return null;
    }),
  );

  if (typeof fields.total !== 'number') {
    raise(exceptions, 'TOTAL_MISSING', 'Invoice total is missing.', 'total');
    missingFields.push('total');
  } else {
    const subTotal = typeof fields.subTotal === 'number' ? fields.subTotal : lineItemsTotal;
    if (typeof subTotal === 'number') {
      const expected = roundTo2(subTotal + taxTotal);
      if (!nearlyEqual(expected, fields.total)) {
        raise(
          exceptions,
          'TOTAL_MISMATCH',
          `Total mismatch: taxable ${formatInr(subTotal)} + tax ${formatInr(taxTotal)} = ${formatInr(
            expected,
          )}, but the invoice shows ${formatInr(fields.total)}.`,
          'total',
        );
      }
    }

    if (
      typeof fields.subTotal === 'number' &&
      typeof lineItemsTotal === 'number' &&
      !nearlyEqual(fields.subTotal, lineItemsTotal)
    ) {
      raise(
        exceptions,
        'TOTAL_MISMATCH',
        `Line items add up to ${formatInr(lineItemsTotal)} but the taxable value reads ${formatInr(
          fields.subTotal,
        )}.`,
        'subTotal',
      );
    }
  }

  // --- Tax structure -------------------------------------------------------
  const cgst = fields.tax.cgst ?? 0;
  const sgst = fields.tax.sgst ?? 0;
  const igst = fields.tax.igst ?? 0;

  if (igst > 0 && (cgst > 0 || sgst > 0)) {
    raise(
      exceptions,
      'TAX_SPLIT_INVALID',
      'The invoice charges IGST together with CGST/SGST. A supply is either interstate or intrastate, not both.',
      'tax.igst',
    );
  }

  if (igst === 0 && (cgst > 0 || sgst > 0) && !nearlyEqual(cgst, sgst, 0.5)) {
    raise(
      exceptions,
      'TAX_MISMATCH',
      `CGST ${formatInr(cgst)} and SGST ${formatInr(sgst)} must be equal on an intrastate invoice.`,
      'tax.sgst',
    );
  }

  const taxableBase = typeof fields.subTotal === 'number' ? fields.subTotal : lineItemsTotal;
  if (typeof taxableBase === 'number' && taxableBase > 0 && taxTotal > 0) {
    const rate = (taxTotal / taxableBase) * 100;
    const standardRates = [0, 0.25, 3, 5, 12, 18, 28];
    const closest = standardRates.reduce((best, candidate) =>
      Math.abs(candidate - rate) < Math.abs(best - rate) ? candidate : best,
    );
    if (Math.abs(closest - rate) > 0.6) {
      raise(
        exceptions,
        'TAX_MISMATCH',
        `Effective GST rate works out to ${rate.toFixed(2)}%, which is not a standard slab. Verify the tax figures.`,
        'tax.cgst',
      );
    }
  }

  // --- Place of supply sanity check ---------------------------------------
  if (gstinCheck.ok && igst > 0 && fields.placeOfSupply) {
    const vendorState = GST_STATE_NAMES[gstinCheck.stateCode];
    if (vendorState && fields.placeOfSupply.toLowerCase().includes(vendorState.toLowerCase())) {
      raise(
        exceptions,
        'TAX_SPLIT_INVALID',
        `IGST is charged but the vendor and the place of supply are both in ${vendorState}. This should be CGST + SGST.`,
        'tax.igst',
      );
    }
  }

  // --- Trust signals -------------------------------------------------------
  if (fields.hasSignature === false) {
    raise(
      exceptions,
      'SIGNATURE_MISSING',
      'No authorised signature or seal was detected on the invoice.',
      'hasSignature',
    );
  }

  if (typeof input.confidence === 'number' && input.confidence < LOW_CONFIDENCE_THRESHOLD) {
    raise(
      exceptions,
      'LOW_CONFIDENCE',
      `Extraction confidence is ${(input.confidence * 100).toFixed(0)}%. Check every field against the image.`,
    );
  }

  if (input.duplicateOfDocumentId) {
    raise(
      exceptions,
      'DUPLICATE_INVOICE',
      `This vendor and invoice number were already recorded on document ${input.duplicateOfDocumentId}.`,
      'invoiceNumber',
    );
  }

  const requiresReview = exceptions.some((exception) => exception.severity === 'BLOCKING');

  return {
    exceptions,
    requiresReview,
    reviewNote: buildReviewNote(exceptions, requiresReview),
    missingFields,
  };
}

function buildReviewNote(exceptions: InvoiceException[], requiresReview: boolean): string {
  if (exceptions.length === 0) {
    return 'All checks passed. Vendor, GSTIN, tax split and totals reconcile.';
  }
  const blocking = exceptions.filter((exception) => exception.severity === 'BLOCKING');
  const warnings = exceptions.filter((exception) => exception.severity === 'WARNING');

  if (!requiresReview) {
    return `Ready for approval with ${warnings.length} note${warnings.length === 1 ? '' : 's'}: ${warnings
      .map((warning) => warning.message)
      .join(' ')}`;
  }

  const lead =
    blocking.length === 1
      ? '1 issue needs your attention.'
      : `${blocking.length} issues need your attention.`;
  return `${lead} ${blocking.map((exception) => exception.message).join(' ')}`;
}

/** Reminder text sent back to the vendor for the fields we could not read. */
export function buildReminderMessage(input: {
  vendorName: string | null;
  invoiceNumber: string | null;
  missingFields: string[];
  senderName: string;
}): string {
  const greeting = input.vendorName ? `Hello ${input.vendorName} team,` : 'Hello,';
  const reference = input.invoiceNumber
    ? `invoice ${input.invoiceNumber}`
    : 'the invoice you sent us';
  const labels = input.missingFields.map((field) => FIELD_LABELS[field] ?? field);

  const ask =
    labels.length === 0
      ? 'Could you please share a clearer copy of the document?'
      : `Could you please share the ${formatList(labels)}? We need ${
          labels.length === 1 ? 'it' : 'them'
        } to record the bill for GST input credit.`;

  return `${greeting}\n\nWe received ${reference} but a few details are not readable. ${ask}\n\nThank you,\n${input.senderName}`;
}

/** Email asking the vendor to send the fields extraction could not read. */
export function buildMissingInfoEmail(input: {
  vendorName: string | null;
  invoiceNumber: string | null;
  missingFields: string[];
  senderName: string;
}): { subject: string; body: string } {
  const reference = input.invoiceNumber ? `invoice ${input.invoiceNumber}` : 'your invoice';
  return {
    subject: `Action needed: missing details on ${reference}`,
    body: buildReminderMessage(input),
  };
}

/** Email telling the vendor their invoice was declined, and why. */
export function buildDeclineEmail(input: {
  vendorName: string | null;
  invoiceNumber: string | null;
  reason: string | null;
  senderName: string;
}): { subject: string; body: string } {
  const greeting = input.vendorName ? `Hello ${input.vendorName} team,` : 'Hello,';
  const reference = input.invoiceNumber
    ? `invoice ${input.invoiceNumber}`
    : 'the invoice you sent us';
  const reason = input.reason ?? 'It did not pass our review checks.';

  return {
    subject: input.invoiceNumber
      ? `Invoice ${input.invoiceNumber} has been declined`
      : 'Your invoice has been declined',
    body: `${greeting}\n\nWe reviewed ${reference} and it has been declined.\nReason: ${reason}\n\nPlease correct the document and send it again, or reply to this email for further information.\n\nThank you,\n${input.senderName}`,
  };
}

function formatList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

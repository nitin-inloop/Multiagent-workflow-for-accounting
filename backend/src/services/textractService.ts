import {
  AnalyzeExpenseCommand,
  TextractClient,
  type ExpenseDocument,
  type ExpenseField,
} from '@aws-sdk/client-textract';
import { config } from '../config/env.js';
import {
  emptyInvoiceFields,
  type InvoiceFields,
  type LineItem,
} from '../types/document.js';
import { parseInvoiceDate } from '../utils/dates.js';
import { normalizeGstin } from '../utils/gstin.js';
import { parseAmount, roundTo2 } from '../utils/money.js';
import { logger } from '../utils/logger.js';

export interface TextractExtraction {
  fields: InvoiceFields;
  confidence: number;
  /** Field-level confidences, used to decide which values Gemini should review. */
  fieldConfidence: Record<string, number>;
  raw: unknown;
}

const GSTIN_IN_TEXT = /\b[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/;

/**
 * Textract AnalyzeExpense returns typed summary fields plus line-item groups.
 * This maps its vocabulary onto our invoice model. Anything Textract is not
 * sure about is left null so validation can raise it as an exception.
 */
export class TextractService {
  private readonly client = new TextractClient({
    region: config.aws.region,
    // A dead credential should reach the fallback in a second, not in ten.
    maxAttempts: config.aws.maxAttempts,
  });

  /**
   * Resolves the credential chain once at boot. The first AWS call otherwise
   * pays for credential lookup and a TLS handshake on top of the OCR itself,
   * which is exactly the upload a person is watching.
   */
  async warm(): Promise<void> {
    await this.client.config.credentials();
  }

  async analyzeExpense(bytes: Buffer): Promise<TextractExtraction> {
    const response = await this.client.send(
      new AnalyzeExpenseCommand({ Document: { Bytes: bytes } }),
      { abortSignal: AbortSignal.timeout(config.aws.textractTimeoutMs) },
    );

    const documents = response.ExpenseDocuments ?? [];
    if (documents.length === 0) {
      throw new Error('Textract returned no expense documents');
    }

    const extraction = mapExpenseDocument(documents[0] as ExpenseDocument);
    logger.debug('Textract extraction complete', {
      confidence: extraction.confidence,
      lineItems: extraction.fields.lineItems.length,
    });
    return { ...extraction, raw: response };
  }
}

function fieldType(field: ExpenseField): string {
  return (field.Type?.Text ?? '').toUpperCase();
}

function fieldLabel(field: ExpenseField): string {
  return (field.LabelDetection?.Text ?? '').toUpperCase();
}

function fieldValue(field: ExpenseField): string | null {
  const text = field.ValueDetection?.Text?.trim();
  return text && text.length > 0 ? text : null;
}

function fieldConfidenceOf(field: ExpenseField): number {
  const value = field.ValueDetection?.Confidence ?? field.Type?.Confidence ?? 0;
  return value / 100;
}

export function mapExpenseDocument(document: ExpenseDocument): Omit<TextractExtraction, 'raw'> {
  const fields = emptyInvoiceFields();
  const fieldConfidence: Record<string, number> = {};
  const confidences: number[] = [];
  let allText = '';

  const assign = <K extends keyof InvoiceFields>(
    key: K,
    value: InvoiceFields[K],
    confidence: number,
    path = key as string,
  ): void => {
    fields[key] = value;
    fieldConfidence[path] = confidence;
    confidences.push(confidence);
  };

  for (const field of document.SummaryFields ?? []) {
    const type = fieldType(field);
    const label = fieldLabel(field);
    const value = fieldValue(field);
    const confidence = fieldConfidenceOf(field);
    if (value) allText += ` ${value}`;
    if (label) allText += ` ${label}`;
    if (!value) continue;

    switch (type) {
      case 'VENDOR_NAME':
      case 'SUPPLIER_NAME':
        if (!fields.vendorName) assign('vendorName', cleanVendor(value), confidence);
        break;
      case 'INVOICE_RECEIPT_ID':
      case 'RECEIPT_ID':
        if (!fields.invoiceNumber) assign('invoiceNumber', value.replace(/\s+/g, ' ').trim(), confidence);
        break;
      case 'INVOICE_RECEIPT_DATE':
      case 'ORDER_DATE': {
        const parsed = parseInvoiceDate(value);
        if (parsed && !fields.invoiceDate) assign('invoiceDate', parsed, confidence);
        break;
      }
      case 'TOTAL':
      case 'AMOUNT_DUE': {
        const amount = parseAmount(value);
        if (amount !== null && fields.total === null) assign('total', amount, confidence);
        break;
      }
      case 'SUBTOTAL': {
        const amount = parseAmount(value);
        if (amount !== null && fields.subTotal === null) assign('subTotal', amount, confidence);
        break;
      }
      case 'TAX':
      case 'TOTAL_TAX': {
        // Textract does not split Indian GST components; use the label.
        const amount = parseAmount(value);
        if (amount === null) break;
        if (label.includes('IGST')) {
          fields.tax = { ...fields.tax, igst: amount };
          fieldConfidence['tax.igst'] = confidence;
        } else if (label.includes('CGST')) {
          fields.tax = { ...fields.tax, cgst: amount };
          fieldConfidence['tax.cgst'] = confidence;
        } else if (label.includes('SGST') || label.includes('UTGST')) {
          fields.tax = { ...fields.tax, sgst: amount };
          fieldConfidence['tax.sgst'] = confidence;
        } else if (fields.tax.cgst === null && fields.tax.sgst === null && fields.tax.igst === null) {
          // Unlabelled tax on an intrastate bill splits evenly.
          const half = roundTo2(amount / 2);
          fields.tax = { cgst: half, sgst: roundTo2(amount - half), igst: null };
          fieldConfidence['tax.cgst'] = confidence * 0.8;
          fieldConfidence['tax.sgst'] = confidence * 0.8;
        }
        confidences.push(confidence);
        break;
      }
      case 'TAX_PAYER_ID':
      case 'VENDOR_GST_NUMBER': {
        const gstin = normalizeGstin(value);
        if (gstin && !fields.gstin) assign('gstin', gstin, confidence);
        break;
      }
      case 'VENDOR_ADDRESS':
      case 'RECEIVER_ADDRESS':
        if (!fields.placeOfSupply) assign('placeOfSupply', value.replace(/\s+/g, ' ').trim(), confidence);
        break;
      default:
        // Labels carry GST numbers on many Indian invoices Textract types as OTHER.
        if (!fields.gstin && (label.includes('GST') || label.includes('GSTIN'))) {
          const gstin = normalizeGstin(value);
          if (gstin) assign('gstin', gstin, confidence);
        }
        break;
    }
  }

  // Last resort: scan every value for something GSTIN-shaped.
  if (!fields.gstin) {
    const match = allText.toUpperCase().replace(/[\s-]/g, '').match(GSTIN_IN_TEXT);
    if (match) {
      fields.gstin = match[0];
      fieldConfidence.gstin = 0.6;
      confidences.push(0.6);
    }
  }

  fields.lineItems = mapLineItems(document, fieldConfidence, confidences);

  if (fields.subTotal === null && fields.lineItems.length > 0) {
    const sum = fields.lineItems.reduce<number | null>((acc, item) => {
      if (item.amount === null) return acc;
      return roundTo2((acc ?? 0) + item.amount);
    }, null);
    if (sum !== null) fields.subTotal = sum;
  }

  const confidence =
    confidences.length > 0
      ? Math.min(1, confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0;

  return { fields, confidence: Number(confidence.toFixed(4)), fieldConfidence };
}

function mapLineItems(
  document: ExpenseDocument,
  fieldConfidence: Record<string, number>,
  confidences: number[],
): LineItem[] {
  const items: LineItem[] = [];

  for (const group of document.LineItemGroups ?? []) {
    for (const lineItem of group.LineItems ?? []) {
      const item: LineItem = { name: '', quantity: null, rate: null, amount: null, hsn: null };
      let itemConfidence = 0;
      let seen = 0;

      for (const field of lineItem.LineItemExpenseFields ?? []) {
        const type = fieldType(field);
        const label = fieldLabel(field);
        const value = fieldValue(field);
        if (!value) continue;
        itemConfidence += fieldConfidenceOf(field);
        seen += 1;

        switch (type) {
          case 'ITEM':
          case 'PRODUCT_CODE':
            if (item.name.length === 0) item.name = value.replace(/\s+/g, ' ').trim();
            break;
          case 'QUANTITY':
            item.quantity = parseAmount(value);
            break;
          case 'UNIT_PRICE':
            item.rate = parseAmount(value);
            break;
          case 'PRICE':
            item.amount = parseAmount(value);
            break;
          case 'EXPENSE_ROW':
            if (item.name.length === 0) item.name = value.replace(/\s+/g, ' ').trim();
            break;
          default:
            if (label.includes('HSN') || label.includes('SAC')) {
              item.hsn = value.trim();
            } else if (item.amount === null && label.includes('AMOUNT')) {
              item.amount = parseAmount(value);
            }
            break;
        }
      }

      if (item.amount === null && item.quantity !== null && item.rate !== null) {
        item.amount = roundTo2(item.quantity * item.rate);
      }

      if (item.name.length > 0 || item.amount !== null) {
        items.push({ ...item, name: item.name.length > 0 ? item.name : 'Unlabelled item' });
        if (seen > 0) {
          const average = itemConfidence / seen;
          fieldConfidence[`lineItems.${items.length - 1}`] = average;
          confidences.push(average);
        }
      }
    }
  }

  return items;
}

function cleanVendor(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^(m\/s\.?|messrs\.?)\s+/i, '')
    .trim();
}

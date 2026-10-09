import { createHash } from 'node:crypto';

/** Content hash used for duplicate detection (GSI2 partition key). */
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Legal-form suffixes that OCR keeps or drops at random. */
const VENDOR_NOISE = /(PVT|PRIVATE|LTD|LIMITED|LLP|INC|CORP|COMPANY|CO|AND|THE)/g;

/**
 * Fingerprint of the accounting identity of an invoice. Two documents with the
 * same vendor and invoice number are the same bill even when the images differ,
 * which is what happens when a supplier resends a photo on WhatsApp.
 *
 * The vendor name is preferred over the GSTIN because the resent copy often
 * reads a GSTIN the first copy did not.
 */
export function invoiceFingerprint(input: {
  gstin: string | null;
  vendorName: string | null;
  invoiceNumber: string | null;
}): string | null {
  const vendor = normalizeVendor(input.vendorName) ?? input.gstin?.trim().toUpperCase() ?? '';
  const number = (input.invoiceNumber ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (vendor.length === 0 || number.length === 0) return null;
  return createHash('sha256').update(`${vendor}|${number}`).digest('hex').slice(0, 32);
}

function normalizeVendor(vendorName: string | null): string | null {
  if (!vendorName) return null;
  const normalized = vendorName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .join(' ')
    .replace(VENDOR_NOISE, '')
    .replace(/\s+/g, '');
  return normalized.length >= 3 ? normalized : null;
}

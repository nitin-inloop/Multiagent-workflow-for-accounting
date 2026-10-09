/**
 * GSTIN format and checksum validation.
 *
 * A GSTIN is 15 characters: 2 digit state code, 10 character PAN,
 * 1 entity number, 1 letter (Z by default), 1 check digit.
 * The check digit is computed with the standard GSTN mod-36 algorithm.
 */

const GSTIN_PATTERN = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const CHECKSUM_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Valid Indian GST state / UT codes (01-38, plus 97 other territory, 99 centre). */
const VALID_STATE_CODES = new Set([
  ...Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, '0')),
  '97',
  '99',
]);

export function normalizeGstin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-_.]/g, '').toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
}

export function gstinChecksumDigit(first14: string): string | null {
  if (first14.length !== 14) return null;
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const value = CHECKSUM_ALPHABET.indexOf(first14[i] as string);
    if (value < 0) return null;
    const factor = i % 2 === 0 ? 1 : 2;
    const product = value * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkValue = (36 - (sum % 36)) % 36;
  return CHECKSUM_ALPHABET[checkValue] ?? null;
}

export type GstinValidation =
  | { ok: true; gstin: string; stateCode: string; pan: string }
  | { ok: false; reason: 'MISSING' | 'FORMAT' | 'STATE_CODE' | 'CHECKSUM' };

export function validateGstin(raw: string | null | undefined): GstinValidation {
  const gstin = normalizeGstin(raw);
  if (!gstin) return { ok: false, reason: 'MISSING' };
  if (gstin.length !== 15 || !GSTIN_PATTERN.test(gstin)) {
    return { ok: false, reason: 'FORMAT' };
  }
  const stateCode = gstin.slice(0, 2);
  if (!VALID_STATE_CODES.has(stateCode)) {
    return { ok: false, reason: 'STATE_CODE' };
  }
  const expected = gstinChecksumDigit(gstin.slice(0, 14));
  if (expected === null || expected !== gstin[14]) {
    return { ok: false, reason: 'CHECKSUM' };
  }
  return { ok: true, gstin, stateCode, pan: gstin.slice(2, 12) };
}

/** State code -> name, used to explain place-of-supply and IGST expectations. */
export const GST_STATE_NAMES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

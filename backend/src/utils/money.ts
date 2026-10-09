/** Rupee amounts are compared with a small tolerance because scans round paise. */
export const AMOUNT_TOLERANCE = 1.0;

export function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function nearlyEqual(a: number, b: number, tolerance = AMOUNT_TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Parse a number out of OCR text. Handles Indian formatting such as
 * "Rs. 1,23,456.78", "₹2950/-", "(1,200.00)" and trailing "CR".
 */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? roundTo2(raw) : null;
  if (typeof raw !== 'string') return null;

  const text = raw.trim();
  if (text.length === 0) return null;

  const negative = /^\(.*\)$/.test(text) || /\bCR\b/i.test(text);
  const stripped = text.replace(/[^0-9.,-]/g, '');
  if (stripped.length === 0) return null;

  // Drop thousands separators, keep the last dot as the decimal point.
  const withoutCommas = stripped.replace(/,/g, '');
  const lastDot = withoutCommas.lastIndexOf('.');
  let normalized = withoutCommas;
  if (lastDot >= 0) {
    normalized = `${withoutCommas.slice(0, lastDot).replace(/\./g, '')}.${withoutCommas
      .slice(lastDot + 1)
      .replace(/\./g, '')}`;
  }

  const value = Number.parseFloat(normalized.replace(/-/g, ''));
  if (!Number.isFinite(value)) return null;
  return roundTo2(negative ? -value : value);
}

export function sumNullable(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (present.length === 0) return null;
  return roundTo2(present.reduce((acc, v) => acc + v, 0));
}

export function formatInr(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return value.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  });
}

/**
 * Invoice dates arrive as "23/08/2026", "23-Aug-2026", "2026-08-23", "23.08.26".
 * Indian invoices are day-first, so ambiguous values are read as DD/MM.
 */

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function expandYear(value: number): number {
  if (value >= 1000) return value;
  return value < 70 ? 2000 + value : 1900 + value;
}

/** Returns an ISO `YYYY-MM-DD` string, or null when the input is not a date. */
export function parseInvoiceDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (text.length === 0) return null;

  const isoMatch = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return iso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const named = text.match(/(\d{1,2})[\s\-/.]*([A-Za-z]{3,9})[\s\-/.,]*(\d{2,4})/);
  if (named) {
    const month = MONTHS[(named[2] as string).toLowerCase()];
    if (month) {
      return iso(expandYear(Number(named[3])), month, Number(named[1]));
    }
  }

  const namedFirst = text.match(/([A-Za-z]{3,9})[\s\-/.]*(\d{1,2})[\s\-/.,]*(\d{2,4})/);
  if (namedFirst) {
    const month = MONTHS[(namedFirst[1] as string).toLowerCase()];
    if (month) {
      return iso(expandYear(Number(namedFirst[3])), month, Number(namedFirst[2]));
    }
  }

  const numeric = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = expandYear(Number(numeric[3]));
    // Day-first unless that is impossible.
    if (first <= 31 && second <= 12) return iso(year, second, first);
    if (second <= 31 && first <= 12) return iso(year, first, second);
  }

  return null;
}

export function isFutureDate(isoDate: string, now = new Date()): boolean {
  const parsed = Date.parse(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) return false;
  // Allow one day of slack for timezone differences.
  return parsed > now.getTime() + 24 * 60 * 60 * 1000;
}

export function nowIso(): string {
  return new Date().toISOString();
}

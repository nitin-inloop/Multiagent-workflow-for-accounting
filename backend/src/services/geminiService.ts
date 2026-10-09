import { z } from 'zod';
import { config } from '../config/env.js';
import {
  emptyInvoiceFields,
  lineItemSchema,
  taxSchema,
  type InvoiceFields,
} from '../types/document.js';
import { parseInvoiceDate } from '../utils/dates.js';
import { normalizeGstin } from '../utils/gstin.js';
import { logger } from '../utils/logger.js';
import { parseAmount } from '../utils/money.js';

/**
 * Gemini has exactly one job here: tidy up labels that OCR read badly and
 * write a one-paragraph explanation for the accountant. It is never allowed to
 * introduce a value the document did not contain, and every number it returns
 * is re-validated by validationService afterwards.
 *
 * It talks to the Generative Language REST API with a plain API key, so there
 * is no SDK to install and no cloud credential chain to arrange.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** A vision pass over a large scan is slow; a stuck one must not hold an upload open. */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Inline uploads share a 20 MB request budget and base64 adds a third on top,
 * so refuse a file that cannot fit instead of sending a doomed request.
 */
const MAX_INLINE_BASE64_BYTES = 18 * 1024 * 1024;

const SYSTEM_PROMPT = `You are an invoice validation assistant for an Indian accounting workflow.
Use ONLY the extracted fields supplied in the user message. Never invent a value.
Never calculate a missing total, tax or quantity - if it was not extracted, return null.
Normalize formatting only: trim vendor names, uppercase GSTIN, convert dates to YYYY-MM-DD,
convert amounts to plain numbers without currency symbols or thousand separators.
If a field is uncertain or absent, set it to null and list its name in missingFields.
List any field whose extracted value looks internally inconsistent in suspiciousFields.
Reply with a single JSON object and no other text, using exactly this shape:
{"fields":{"vendorName":string|null,"gstin":string|null,"invoiceNumber":string|null,"invoiceDate":string|null,"placeOfSupply":string|null,"lineItems":[{"name":string,"quantity":number|null,"rate":number|null,"amount":number|null,"hsn":string|null}],"subTotal":number|null,"tax":{"cgst":number|null,"sgst":number|null,"igst":number|null},"total":number|null},"missingFields":[string],"suspiciousFields":[string],"explanation":string}`;

const geminiResponseSchema = z.object({
  fields: z.object({
    vendorName: z.string().nullable().optional(),
    gstin: z.string().nullable().optional(),
    invoiceNumber: z.string().nullable().optional(),
    invoiceDate: z.string().nullable().optional(),
    placeOfSupply: z.string().nullable().optional(),
    lineItems: z.array(lineItemSchema.partial({ quantity: true, rate: true, amount: true, hsn: true })).optional(),
    subTotal: z.union([z.number(), z.string()]).nullable().optional(),
    tax: taxSchema.partial().optional(),
    total: z.union([z.number(), z.string()]).nullable().optional(),
  }),
  missingFields: z.array(z.string()).default([]),
  suspiciousFields: z.array(z.string()).default([]),
  explanation: z.string().default(''),
});

export interface NormalizationResult {
  fields: InvoiceFields;
  missingFields: string[];
  suspiciousFields: string[];
  explanation: string;
}

/**
 * Vision extraction: used when Textract is not configured. Gemini reads the
 * invoice image directly. The same rules apply as everywhere else - the model
 * transcribes what is printed, deterministic code decides what it means.
 */
const VISION_SYSTEM_PROMPT = `You are an invoice extraction assistant for an Indian accounting workflow.
Read the supplied invoice document and transcribe ONLY what is printed on it. Never invent or calculate a value.
If a value is unreadable or absent, set it to null and list its name in missingFields.
Dates must be YYYY-MM-DD. Amounts must be plain numbers with no currency symbols or separators.
gstin is the SUPPLIER's 15-character GST number, uppercase (not the buyer's).
subTotal is the taxable value before tax. total is the grand total printed on the bill.
hasSignature is true only when a handwritten signature, initials or a stamp is visible; false when the signature area is clearly blank; null when unclear.
confidence is your overall reading confidence between 0 and 1; lower it for blurry or cut-off scans.
Reply with a single JSON object and no other text, using exactly this shape:
{"fields":{"vendorName":string|null,"gstin":string|null,"invoiceNumber":string|null,"invoiceDate":string|null,"placeOfSupply":string|null,"lineItems":[{"name":string,"quantity":number|null,"rate":number|null,"amount":number|null,"hsn":string|null}],"subTotal":number|null,"tax":{"cgst":number|null,"sgst":number|null,"igst":number|null},"total":number|null,"hasSignature":boolean|null},"confidence":number,"missingFields":[string],"explanation":string}`;

const visionResponseSchema = z.object({
  fields: z.object({
    vendorName: z.string().nullable().optional(),
    gstin: z.string().nullable().optional(),
    invoiceNumber: z.string().nullable().optional(),
    invoiceDate: z.string().nullable().optional(),
    placeOfSupply: z.string().nullable().optional(),
    lineItems: z
      .array(lineItemSchema.partial({ quantity: true, rate: true, amount: true, hsn: true }))
      .optional(),
    subTotal: z.union([z.number(), z.string()]).nullable().optional(),
    tax: taxSchema.partial().optional(),
    total: z.union([z.number(), z.string()]).nullable().optional(),
    hasSignature: z.boolean().nullable().optional(),
  }),
  confidence: z.number().optional(),
  missingFields: z.array(z.string()).default([]),
  explanation: z.string().default(''),
});

export interface VisionExtractionResult {
  fields: InvoiceFields;
  confidence: number;
  missingFields: string[];
  explanation: string;
}

/** What Gemini accepts as inline document data. Anything else stays with OCR. */
const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
}

export class GeminiService {
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    if (!config.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY must be set before the Gemini extractor can be used');
    }
    this.apiKey = config.gemini.apiKey;
    this.model = config.gemini.model;
  }

  /** One HTTP round-trip. Timeouts and transport faults come back as Errors. */
  private async post(body: string): Promise<Response> {
    try {
      return await fetch(`${API_BASE}/${encodeURIComponent(this.model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const cause = error as Error;
      throw new Error(
        cause.name === 'TimeoutError'
          ? `Gemini did not respond within ${REQUEST_TIMEOUT_MS / 1000}s`
          : `Gemini request failed: ${cause.message}`,
      );
    }
  }

  /** One generateContent round-trip that must come back as JSON. */
  private async generateJson(
    system: string,
    parts: GeminiPart[],
    maxOutputTokens: number,
  ): Promise<unknown> {
    const body = (thinkingLevel?: string): string =>
      JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0,
          topP: 0.1,
          maxOutputTokens,
          responseMimeType: 'application/json',
          ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
        },
      });

    const level = config.gemini.thinkingLevel === 'off' ? undefined : config.gemini.thinkingLevel;
    let response = await this.post(body(level));

    // Reasoning depth is not spelled the same way across model generations. A
    // 400 that names the field means this model will not take it, which is no
    // reason to give up on the document - ask again and let the model decide.
    if (!response.ok && response.status === 400 && level) {
      const detail = await errorDetail(response);
      if (!/think/i.test(detail)) {
        throw new Error(`Gemini returned HTTP 400: ${detail}`);
      }
      logger.debug('Gemini rejected thinkingLevel; retrying with the model default', { detail });
      response = await this.post(body());
    }

    if (!response.ok) {
      throw new Error(`Gemini returned HTTP ${response.status}: ${await errorDetail(response)}`);
    }

    const result = (await response.json()) as GeminiResponse;
    const candidate = result.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('')
      .trim();

    if (text.length === 0) {
      // MAX_TOKENS here means the budget ran out; SAFETY means the document was
      // blocked. Either way the caller falls back rather than guessing.
      const reason =
        candidate?.finishReason ?? result.promptFeedback?.blockReason ?? 'no candidate';
      throw new Error(`Gemini returned an empty response (${reason})`);
    }

    return extractJson(text);
  }

  async normalize(input: {
    fields: InvoiceFields;
    fieldConfidence: Record<string, number>;
  }): Promise<NormalizationResult> {
    const payload = {
      extractedFields: input.fields,
      fieldConfidence: input.fieldConfidence,
    };

    const raw = await this.generateJson(SYSTEM_PROMPT, [{ text: JSON.stringify(payload) }], 4096);

    const parsed = geminiResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Gemini response failed schema validation: ${parsed.error.issues
          .map((issue) => issue.path.join('.'))
          .join(', ')}`,
      );
    }

    const merged = mergeNormalized(input.fields, parsed.data.fields);
    logger.debug('Gemini normalization applied', {
      missingFields: parsed.data.missingFields.length,
      suspiciousFields: parsed.data.suspiciousFields.length,
    });

    return {
      fields: merged,
      missingFields: parsed.data.missingFields,
      suspiciousFields: parsed.data.suspiciousFields,
      explanation: parsed.data.explanation.trim(),
    };
  }

  /**
   * Reads an invoice image or PDF with the vision model. Used as the primary
   * extractor when Textract is not configured. Throws for file types Gemini
   * cannot take (SVG samples never reach here - they use the demo path).
   */
  async extractFromDocument(input: {
    bytes: Buffer;
    mimeType: string;
  }): Promise<VisionExtractionResult> {
    const raw = await this.generateJson(
      VISION_SYSTEM_PROMPT,
      [
        inlineDataPart(input.bytes, input.mimeType),
        { text: 'Extract the invoice fields as specified.' },
      ],
      8192,
    );

    const parsed = visionResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Gemini vision response failed schema validation: ${parsed.error.issues
          .map((issue) => issue.path.join('.'))
          .join(', ')}`,
      );
    }

    const fields = coerceVisionFields(parsed.data.fields);
    // An out-of-range or missing self-assessment reads as "not sure", which the
    // validator turns into a low-confidence review flag rather than a guess.
    const confidence =
      typeof parsed.data.confidence === 'number' && Number.isFinite(parsed.data.confidence)
        ? Math.min(1, Math.max(0, parsed.data.confidence))
        : 0.6;

    logger.debug('Gemini vision extraction complete', {
      confidence,
      lineItems: fields.lineItems.length,
    });

    return {
      fields,
      confidence,
      missingFields: parsed.data.missingFields,
      explanation: parsed.data.explanation.trim(),
    };
  }
}

/** Builds the inline-data part for the uploaded file. */
function inlineDataPart(bytes: Buffer, mimeType: string): GeminiPart {
  const normalized = mimeType.toLowerCase();
  if (!SUPPORTED_MIME_TYPES.has(normalized)) {
    throw new Error(`Gemini vision cannot read "${mimeType}" files`);
  }

  const data = bytes.toString('base64');
  if (data.length > MAX_INLINE_BASE64_BYTES) {
    throw new Error(
      `File is ${Math.round(bytes.length / (1024 * 1024))} MB, too large to send to Gemini inline`,
    );
  }

  return {
    inlineData: {
      // Browsers send image/jpg for some scans; Gemini only knows image/jpeg.
      mimeType: normalized === 'image/jpg' ? 'image/jpeg' : normalized,
      data,
    },
  };
}

/** Keeps an API error body short enough for one log line. */
async function errorDetail(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // Not JSON - fall through to the raw body.
  }
  return body.slice(0, 300) || response.statusText;
}

/** Coerces the model's transcription into typed fields; parse failures -> null. */
function coerceVisionFields(
  suggested: z.infer<typeof visionResponseSchema>['fields'],
): InvoiceFields {
  const text = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return {
    ...emptyInvoiceFields(),
    vendorName: text(suggested.vendorName),
    gstin: normalizeGstin(text(suggested.gstin)),
    invoiceNumber: text(suggested.invoiceNumber),
    invoiceDate: suggested.invoiceDate ? parseInvoiceDate(suggested.invoiceDate) : null,
    placeOfSupply: text(suggested.placeOfSupply),
    lineItems: (suggested.lineItems ?? [])
      .filter((item) => text(item.name) !== null || item.amount != null)
      .map((item) => ({
        name: text(item.name) ?? 'Unlabelled item',
        quantity: parseAmount(item.quantity ?? null),
        rate: parseAmount(item.rate ?? null),
        amount: parseAmount(item.amount ?? null),
        hsn: text(item.hsn),
      })),
    subTotal: parseAmount(suggested.subTotal ?? null),
    tax: {
      cgst: parseAmount(suggested.tax?.cgst ?? null),
      sgst: parseAmount(suggested.tax?.sgst ?? null),
      igst: parseAmount(suggested.tax?.igst ?? null),
    },
    total: parseAmount(suggested.total ?? null),
    hasSignature: typeof suggested.hasSignature === 'boolean' ? suggested.hasSignature : null,
  };
}

/** Models sometimes wrap JSON in prose or a fenced block. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? text;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('Gemini response did not contain JSON');
  }
}

/**
 * The merge is intentionally conservative. Gemini may clean up a string or
 * clear a value it considers unreliable, but a number it produces is only
 * accepted when OCR had nothing at all for that field.
 */
function mergeNormalized(
  original: InvoiceFields,
  suggested: z.infer<typeof geminiResponseSchema>['fields'],
): InvoiceFields {
  const text = (value: string | null | undefined, fallback: string | null): string | null => {
    if (value === null) return null;
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const numberOnlyIfMissing = (
    value: number | string | null | undefined,
    fallback: number | null,
  ): number | null => {
    if (fallback !== null) return fallback;
    const parsedValue = parseAmount(value ?? null);
    return parsedValue;
  };

  const gstin = normalizeGstin(text(suggested.gstin, original.gstin));
  const invoiceDate = suggested.invoiceDate
    ? parseInvoiceDate(suggested.invoiceDate) ?? original.invoiceDate
    : original.invoiceDate;

  const lineItems =
    original.lineItems.length > 0
      ? original.lineItems
      : (suggested.lineItems ?? []).map((item) => ({
          name: item.name,
          quantity: parseAmount(item.quantity ?? null),
          rate: parseAmount(item.rate ?? null),
          amount: parseAmount(item.amount ?? null),
          hsn: item.hsn ?? null,
        }));

  return {
    ...original,
    vendorName: text(suggested.vendorName, original.vendorName),
    gstin,
    invoiceNumber: text(suggested.invoiceNumber, original.invoiceNumber),
    invoiceDate,
    placeOfSupply: text(suggested.placeOfSupply, original.placeOfSupply),
    lineItems,
    subTotal: numberOnlyIfMissing(suggested.subTotal, original.subTotal),
    tax: {
      cgst: numberOnlyIfMissing(suggested.tax?.cgst, original.tax.cgst),
      sgst: numberOnlyIfMissing(suggested.tax?.sgst, original.tax.sgst),
      igst: numberOnlyIfMissing(suggested.tax?.igst, original.tax.igst),
    },
    total: numberOnlyIfMissing(suggested.total, original.total),
  };
}

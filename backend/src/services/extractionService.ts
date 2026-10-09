import { config } from '../config/env.js';
import { demoInvoiceForHash, findDemoInvoice } from '../demo/demoInvoices.js';
import type { InvoiceDocument, InvoiceFields, LineItem } from '../types/document.js';
import { validateGstin } from '../utils/gstin.js';
import { logger } from '../utils/logger.js';
import { GeminiService, type VisionExtractionResult } from './geminiService.js';
import { TextractService, type TextractExtraction } from './textractService.js';

export interface ExtractionOutcome {
  engine: InvoiceDocument['extractionEngine'];
  fields: InvoiceFields;
  confidence: number;
  /** Gemini's sentence for the accountant, when it produced one. */
  explanation: string | null;
  /** Non-fatal problems worth showing in the activity log. */
  notes: string[];
  failed: boolean;
}

interface ExtractionInput {
  bytes: Buffer;
  mimeType: string;
  fileHash: string;
  demoSlug?: string | null;
}

/**
 * Once one reader has answered, the other gets this long before we go without
 * it. A second opinion improves the read; it does not improve it enough to hold
 * an upload open while a straggler finishes.
 */
const STRAGGLER_GRACE_MS = 5_000;

/**
 * Chooses the best extraction path available and degrades instead of failing:
 *
 *   Textract ‖ Gemini  ->  both readers at once, merged and cross-checked
 *   Textract + Gemini  ->  OCR, then normalization (the serial fallback)
 *   Textract only      ->  OCR succeeded, the model did not
 *   Gemini vision      ->  no Textract; Gemini reads the image directly
 *   Demo fallback      ->  no extractor configured, or every extractor threw
 *
 * The last row is why the demo cannot break. A presentation must not depend on
 * an API key being pasted in time.
 *
 * The first row is the fast path. Running the two readers concurrently costs
 * max(t_ocr, t_model) instead of their sum, and two independent reads of the
 * same page are worth more than either alone: where they agree, confidence is
 * higher than either reported; where they disagree, the field is flagged for a
 * human instead of being quietly accepted.
 */
export class ExtractionService {
  private readonly textract = config.features.textract ? new TextractService() : null;
  private readonly gemini = config.features.gemini ? new GeminiService() : null;

  /** Both readers live and the parallel path enabled. */
  private get canRunParallel(): boolean {
    return Boolean(this.textract && this.gemini && config.features.parallelExtraction);
  }

  /**
   * Pays for credential resolution and the first TLS handshake at boot instead
   * of on the upload someone is watching. Failure here is not fatal: it means
   * the credentials are unusable, which the extraction ladder already handles.
   */
  async warm(): Promise<void> {
    if (!this.textract) return;
    try {
      await this.textract.warm();
      logger.debug('Textract credentials resolved at boot');
    } catch (error) {
      logger.warn('Textract warm-up failed; the fallback ladder will handle it', {
        error: (error as Error).message,
      });
    }
  }

  async extract(input: ExtractionInput): Promise<ExtractionOutcome> {
    if (input.demoSlug) {
      const demo = findDemoInvoice(input.demoSlug);
      if (demo) {
        return {
          engine: 'DEMO_FALLBACK',
          fields: structuredClone(demo.fields),
          confidence: demo.confidence,
          explanation: demo.teaches,
          notes: ['Seeded demo invoice: extraction values are fixed.'],
          failed: false,
        };
      }
    }

    if (this.canRunParallel) {
      return this.extractInParallel(input);
    }

    if (this.textract) {
      return this.extractWithTextract(input);
    }

    if (this.gemini) {
      return this.extractWithVision(input, []);
    }

    return this.sampleFallback(input.fileHash, [
      'No extraction service is configured, so a representative sample extraction was used for this file.',
    ]);
  }

// PLACEHOLDER_BODY

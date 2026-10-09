import { config } from '../config/env.js';
import { demoInvoiceForHash, findDemoInvoice } from '../demo/demoInvoices.js';
import type { InvoiceDocument, InvoiceFields } from '../types/document.js';
import { logger } from '../utils/logger.js';
import { GeminiService } from './geminiService.js';
import { TextractService } from './textractService.js';

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
 * Chooses the best extraction path available and degrades instead of failing:
 *
 *   Textract + Gemini  ->  OCR plus normalization, when both are on
 *   Textract only      ->  OCR succeeded, normalization did not
 *   Gemini vision      ->  no Textract; Gemini reads the image directly
 *   Demo fallback      ->  no extractor configured, or every extractor threw
 *
 * The last row is why the demo cannot break. A presentation must not depend on
 * an API key being pasted in time.
 */
export class ExtractionService {
  private readonly textract = config.features.textract ? new TextractService() : null;
  private readonly gemini = config.features.gemini ? new GeminiService() : null;

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

  /** Textract OCR, then Gemini label normalization when available. */
  private async extractWithTextract(input: ExtractionInput): Promise<ExtractionOutcome> {
    const textract = this.textract;
    if (!textract) throw new Error('Textract is not configured');

    let ocr;
    try {
      ocr = await textract.analyzeExpense(input.bytes);
    } catch (error) {
      logger.warn('Textract failed', { error: (error as Error).message });
      const note = `Textract call failed (${(error as Error).message}).`;
      // Vision extraction is the better fallback when Gemini is reachable.
      if (this.gemini) return this.extractWithVision(input, [note]);
      return this.sampleFallback(input.fileHash, [`${note} Fallback extraction used.`]);
    }

    if (!this.gemini) {
      return {
        engine: 'TEXTRACT',
        fields: ocr.fields,
        confidence: ocr.confidence,
        explanation: null,
        notes: ['Gemini normalization is disabled; raw OCR fields were kept.'],
        failed: false,
      };
    }

    try {
      const normalized = await this.gemini.normalize({
        fields: ocr.fields,
        fieldConfidence: ocr.fieldConfidence,
      });
      const notes =
        normalized.suspiciousFields.length > 0
          ? [`Model flagged as suspicious: ${normalized.suspiciousFields.join(', ')}.`]
          : [];
      return {
        engine: 'TEXTRACT_GEMINI',
        fields: normalized.fields,
        confidence: ocr.confidence,
        explanation: normalized.explanation.length > 0 ? normalized.explanation : null,
        notes,
        failed: false,
      };
    } catch (error) {
      logger.warn('Gemini normalization failed, keeping OCR output', {
        error: (error as Error).message,
      });
      return {
        engine: 'TEXTRACT',
        fields: ocr.fields,
        confidence: ocr.confidence,
        explanation: null,
        notes: [`Gemini normalization failed (${(error as Error).message}); OCR fields kept.`],
        failed: false,
      };
    }
  }

  /** Gemini reads the document image directly - no Textract involved. */
  private async extractWithVision(
    input: ExtractionInput,
    notes: string[],
  ): Promise<ExtractionOutcome> {
    const gemini = this.gemini;
    if (!gemini) throw new Error('Gemini is not configured');

    try {
      const vision = await gemini.extractFromDocument({
        bytes: input.bytes,
        mimeType: input.mimeType,
      });
      return {
        engine: 'GEMINI_VISION',
        fields: vision.fields,
        confidence: vision.confidence,
        explanation: vision.explanation.length > 0 ? vision.explanation : null,
        notes,
        failed: false,
      };
    } catch (error) {
      logger.warn('Gemini vision extraction failed, using fallback', {
        error: (error as Error).message,
      });
      return this.sampleFallback(input.fileHash, [
        ...notes,
        `Gemini vision extraction failed (${(error as Error).message}); fallback extraction used.`,
      ]);
    }
  }

  /** Deterministic sample so the workflow always has something to show. */
  private sampleFallback(fileHash: string, notes: string[]): ExtractionOutcome {
    const demo = demoInvoiceForHash(fileHash);
    return {
      engine: 'DEMO_FALLBACK',
      fields: structuredClone(demo.fields),
      confidence: demo.confidence,
      explanation: null,
      notes,
      failed: false,
    };
  }
}

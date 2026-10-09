import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config/env.js';
import type { Container } from '../container.js';
import { toAccountingCsv, toTallyXml } from '../services/exportService.js';
import { documentStatusSchema, reviewRequestSchema } from '../types/document.js';
import { badRequest } from '../utils/errors.js';

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/svg+xml',
  'application/pdf',
]);

const listQuerySchema = z.object({
  status: documentStatusSchema.optional(),
});

const demoBodySchema = z.object({ slug: z.string().min(1) });

const exportBodySchema = z.object({
  actor: z.string().min(1).max(120).default('Demo Accountant'),
});

const reminderBodySchema = z.object({
  senderName: z.string().min(1).max(120).default('Demo Accountant, Nagar Enterprises'),
});

const requestInfoBodySchema = z.object({
  senderName: z.string().min(1).max(120).default('Demo Accountant, Nagar Enterprises'),
});

export function documentRoutes(container: Container): Router {
  const router = Router();
  const { documents } = container;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes, files: 1 },
    fileFilter: (_req, file, callback) => {
      if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
        callback(badRequest(`Unsupported file type "${file.mimetype}". Upload a JPG, PNG or PDF.`));
        return;
      }
      callback(null, true);
    },
  });

  /** The built-in samples shown in the upload panel. */
  router.get('/demo-invoices', (_req, res) => {
    res.json({ demoInvoices: documents.demoCatalogue() });
  });

  router.post('/upload', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) throw badRequest('No file was attached. Send it as the "file" field.');
      const document = await documents.createFromUpload({
        bytes: req.file.buffer,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        source: 'UPLOAD',
      });
      // Answer immediately; the inbox polls until extraction finishes.
      documents.processInBackground(document.documentId);
      res.status(202).json({ document });
    } catch (error) {
      next(error);
    }
  });

  router.post('/demo', async (req, res, next) => {
    try {
      const { slug } = demoBodySchema.parse(req.body ?? {});
      const document = await documents.createFromDemo(slug);
      documents.processInBackground(document.documentId, slug);
      res.status(202).json({ document });
    } catch (error) {
      next(error);
    }
  });

  router.get('/stats', async (_req, res, next) => {
    try {
      res.json({ stats: await documents.stats() });
    } catch (error) {
      next(error);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const { status } = listQuerySchema.parse(req.query);
      const [items, stats] = await Promise.all([documents.list(status), documents.stats()]);
      res.json({ documents: items, stats });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const { url, document } = await documents.previewUrl(req.params.id);
      res.json({
        document,
        // Signed S3 URL when available; otherwise the browser reads /file.
        previewUrl: url,
        previewPath: `/api/documents/${document.documentId}/file`,
      });
    } catch (error) {
      next(error);
    }
  });

  /** Streams the original file. Used when storage cannot mint a signed URL. */
  router.get('/:id/file', async (req, res, next) => {
    try {
      const { bytes, document } = await documents.fileBytes(req.params.id);
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.fileName)}"`);
      res.setHeader('Cache-Control', 'private, max-age=60');
      res.send(bytes);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/process', async (req, res, next) => {
    try {
      res.json({ document: await documents.process(req.params.id) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id/review', async (req, res, next) => {
    try {
      const request = reviewRequestSchema.parse(req.body ?? {});
      const { document, notification } = await documents.review(req.params.id, request);
      res.json({ document, notification });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/export/csv', async (req, res, next) => {
    try {
      const { actor } = exportBodySchema.parse(req.body ?? {});
      const document = await documents.markExported(req.params.id, 'CSV', actor);
      const artifact = toAccountingCsv(document);
      res.json({ document, export: { format: 'CSV', ...artifact } });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/export/tally', async (req, res, next) => {
    try {
      const { actor } = exportBodySchema.parse(req.body ?? {});
      const document = await documents.markExported(req.params.id, 'TALLY_XML', actor);
      const artifact = toTallyXml(document);
      res.json({ document, export: { format: 'TALLY_XML', ...artifact } });
    } catch (error) {
      next(error);
    }
  });

  /** Emails the vendor asking them to send the missing credentials. */
  router.post('/:id/request-info', async (req, res, next) => {
    try {
      const { senderName } = requestInfoBodySchema.parse(req.body ?? {});
      const result = await documents.requestMissingInfo(req.params.id, senderName);
      res.json({
        document: result.document,
        request: {
          email: result.email,
          missingFields: result.missingFields,
          note: result.email.delivered
            ? `Sent via SMTP to ${result.email.to}.`
            : result.email.mode === 'SIMULATED'
              ? 'SMTP is not configured, so the email was recorded in the audit trail but not delivered.'
              : `Delivery failed: ${result.email.error ?? 'unknown error'}.`,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/reminder', async (req, res, next) => {
    try {
      const { senderName } = reminderBodySchema.parse(req.body ?? {});
      const result = await documents.reminder(req.params.id, senderName);
      res.json({
        document: result.document,
        reminder: {
          channel: 'WHATSAPP_DRAFT',
          message: result.message,
          missingFields: result.missingFields,
          note: 'Draft only. WhatsApp Business API sending is a post-pilot integration.',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

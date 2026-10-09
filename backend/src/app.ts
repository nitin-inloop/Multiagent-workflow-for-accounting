import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import { ZodError } from 'zod';
import { config } from './config/env.js';
import type { Container } from './container.js';
import { documentRoutes } from './routes/documents.js';
import { HttpError } from './utils/errors.js';
import { logger } from './utils/logger.js';

export function createApp(container: Container): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  const allowAll = config.corsOrigins.includes('*');
  app.use(
    cors({
      origin: allowAll ? true : config.corsOrigins,
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  /** App Runner health check. Also reports which adapters are live. */
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'ledgerflow-api',
      version: process.env.npm_package_version ?? '0.1.0',
      region: config.aws.region,
      adapters: {
        repository: container.repository.name,
        storage: container.storage.name,
        textract: config.features.textract,
        gemini: config.features.gemini ? config.gemini.model : false,
        email: config.features.email ? config.email.vendorEmail : false,
      },
      at: new Date().toISOString(),
    });
  });

  app.use('/api/documents', documentRoutes(container));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res
        .status(error.status)
        .json({ error: { code: error.code, message: error.message, details: error.details } });
      return;
    }

    if (error instanceof ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body failed validation.',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
      return;
    }

    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? `File is larger than the ${Math.round(config.maxUploadBytes / (1024 * 1024))} MB limit.`
          : error.message;
      res.status(400).json({ error: { code: error.code, message } });
      return;
    }

    logger.error('Unhandled error', {
      message: (error as Error)?.message,
      stack: config.isProduction ? undefined : (error as Error)?.stack,
    });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong handling this request.' },
    });
  });

  return app;
}

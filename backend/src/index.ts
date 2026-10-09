import { createApp } from './app.js';
import { config } from './config/env.js';
import { createContainer } from './container.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  const container = await createContainer();
  const app = createApp(container);

  const server = app.listen(config.port, () => {
    logger.info('LedgerFlow API listening', {
      port: config.port,
      env: config.nodeEnv,
      org: config.orgId,
    });
  });

  const shutdown = (signal: string): void => {
    logger.info('Shutting down', { signal });
    server.close(() => process.exit(0));
    // Do not hang a container on a stuck connection.
    setTimeout(() => process.exit(0), 8000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  logger.error('Failed to start LedgerFlow API', { error: (error as Error).message });
  process.exit(1);
});

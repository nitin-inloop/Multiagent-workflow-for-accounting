/**
 * Seeds the inbox with the demo invoices so the dashboard has something to show
 * the moment it loads. Safe to run repeatedly: it skips seeding when documents
 * already exist unless --force is passed.
 */
import { createContainer } from '../container.js';
import { DEMO_INVOICES } from '../demo/demoInvoices.js';
import { MemoryDocumentRepository } from '../repositories/memoryDocumentRepository.js';
import { logger } from '../utils/logger.js';

const force = process.argv.includes('--force');

/** Which samples to seed, and how far along the workflow to take each one. */
const SEED_PLAN: Array<{ slug: string; approve?: boolean; export?: boolean }> = [
  { slug: 'gstin-missing' },
  { slug: 'total-mismatch' },
  { slug: 'faded-thermal' },
  { slug: 'igst-interstate' },
  { slug: 'clean-intrastate', approve: true, export: true },
];

async function main(): Promise<void> {
  const { documents, repository } = await createContainer();

  const existing = await documents.list();
  if (existing.length > 0 && !force) {
    logger.info('Inbox already has documents, skipping seed', { count: existing.length });
    return;
  }

  for (const step of SEED_PLAN) {
    const demo = DEMO_INVOICES.find((entry) => entry.slug === step.slug);
    if (!demo) continue;

    const created = await documents.createFromDemo(demo.slug);
    const processed = await documents.process(created.documentId, demo.slug);
    logger.info('Seeded document', {
      slug: demo.slug,
      documentId: processed.documentId,
      status: processed.status,
      exceptions: processed.exceptions.map((exception) => exception.code),
    });

    if (step.approve && processed.status === 'READY_FOR_APPROVAL') {
      await documents.review(processed.documentId, {
        action: 'APPROVE',
        actor: 'Demo Accountant',
      });
      if (step.export) {
        await documents.markExported(processed.documentId, 'TALLY_XML', 'Demo Accountant');
      }
    }
  }

  if (repository instanceof MemoryDocumentRepository) await repository.flush();
  logger.info('Seed complete', { documents: (await documents.list()).length });
}

main().catch((error: unknown) => {
  logger.error('Seed failed', { error: (error as Error).message });
  process.exit(1);
});

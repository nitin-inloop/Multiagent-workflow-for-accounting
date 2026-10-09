import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { documentSchema, type InvoiceDocument } from '../types/document.js';
import { logger } from '../utils/logger.js';
import type { DocumentRepository, ListDocumentsQuery } from './documentRepository.js';

/**
 * In-process store with a JSON file behind it. This keeps the demo working
 * without an AWS account and survives a backend restart, which matters when
 * you are rehearsing a presentation.
 */
export class MemoryDocumentRepository implements DocumentRepository {
  readonly name = 'memory' as const;

  private readonly documents = new Map<string, InvoiceDocument>();
  private writeQueue: Promise<void> = Promise.resolve();

  private constructor(private readonly filePath: string | null) {}

  static async create(filePath: string | null): Promise<MemoryDocumentRepository> {
    const repository = new MemoryDocumentRepository(filePath);
    if (filePath) await repository.load(filePath);
    return repository;
  }

  private key(orgId: string, documentId: string): string {
    return `${orgId}::${documentId}`;
  }

  private async load(filePath: string): Promise<void> {
    try {
      const contents = await readFile(filePath, 'utf8');
      const parsed: unknown = JSON.parse(contents);
      if (!Array.isArray(parsed)) return;
      let loaded = 0;
      for (const entry of parsed) {
        const result = documentSchema.safeParse(entry);
        if (result.success) {
          this.documents.set(this.key(result.data.orgId, result.data.documentId), result.data);
          loaded += 1;
        }
      }
      logger.info('Loaded local document store', { filePath, loaded });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        logger.warn('Could not read local document store, starting empty', {
          filePath,
          error: (error as Error).message,
        });
      }
    }
  }

  /** Serializes writes so concurrent uploads cannot interleave file writes. */
  private persist(): void {
    if (!this.filePath) return;
    const filePath = this.filePath;
    const snapshot = JSON.stringify([...this.documents.values()], null, 2);
    this.writeQueue = this.writeQueue
      .then(async () => {
        await mkdir(dirname(filePath), { recursive: true });
        const temp = `${filePath}.tmp`;
        await writeFile(temp, snapshot, 'utf8');
        await rename(temp, filePath);
      })
      .catch((error: unknown) => {
        logger.warn('Failed to persist local document store', {
          error: (error as Error).message,
        });
      });
  }

  async put(document: InvoiceDocument): Promise<InvoiceDocument> {
    this.documents.set(this.key(document.orgId, document.documentId), document);
    this.persist();
    return document;
  }

  async get(orgId: string, documentId: string): Promise<InvoiceDocument | null> {
    return this.documents.get(this.key(orgId, documentId)) ?? null;
  }

  async list(query: ListDocumentsQuery): Promise<InvoiceDocument[]> {
    const results = [...this.documents.values()]
      .filter((doc) => doc.orgId === query.orgId)
      .filter((doc) => (query.status ? doc.status === query.status : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return query.limit ? results.slice(0, query.limit) : results;
  }

  async findByFileHash(orgId: string, fileHash: string): Promise<InvoiceDocument[]> {
    return [...this.documents.values()].filter(
      (doc) => doc.orgId === orgId && doc.fileHash === fileHash,
    );
  }

  async findByFingerprint(orgId: string, fingerprint: string): Promise<InvoiceDocument[]> {
    return [...this.documents.values()].filter(
      (doc) => doc.orgId === orgId && doc.fingerprint === fingerprint,
    );
  }

  /** Used by the seeder to know whether demo data already exists. */
  get size(): number {
    return this.documents.size;
  }

  /** Waits for pending disk writes; useful in scripts that exit immediately. */
  async flush(): Promise<void> {
    await this.writeQueue;
  }
}

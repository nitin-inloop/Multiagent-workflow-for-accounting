import type { DocumentStatus, InvoiceDocument } from '../types/document.js';

export interface ListDocumentsQuery {
  orgId: string;
  status?: DocumentStatus;
  limit?: number;
}

/**
 * Storage contract for documents. Two implementations exist: DynamoDB for
 * deployed environments and a file-backed in-memory store for local demos.
 */
export interface DocumentRepository {
  readonly name: 'dynamodb' | 'memory';
  put(document: InvoiceDocument): Promise<InvoiceDocument>;
  get(orgId: string, documentId: string): Promise<InvoiceDocument | null>;
  list(query: ListDocumentsQuery): Promise<InvoiceDocument[]>;
  /** Documents whose uploaded bytes hash to the same value. */
  findByFileHash(orgId: string, fileHash: string): Promise<InvoiceDocument[]>;
  /** Documents with the same vendor + invoice number fingerprint. */
  findByFingerprint(orgId: string, fingerprint: string): Promise<InvoiceDocument[]>;
}

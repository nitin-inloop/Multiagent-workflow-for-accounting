import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { config } from '../config/env.js';
import { documentSchema, type InvoiceDocument } from '../types/document.js';
import { logger } from '../utils/logger.js';
import type { DocumentRepository, ListDocumentsQuery } from './documentRepository.js';

/**
 * Single-table layout, as designed in IMPLEMENTATION_PLAN.md:
 *
 *   PK      ORG#<orgId>
 *   SK      DOC#<documentId>
 *   GSI1PK  ORG#<orgId>#STATUS#<status>   GSI1SK <createdAt>#DOC#<id>
 *   GSI2PK  HASH#<sha256>                 GSI2SK DOC#<id>
 *   GSI3PK  FP#<fingerprint>              GSI3SK DOC#<id>
 *
 * Only normalized fields are stored. Raw OCR output stays in S3 so items
 * never approach the 400 KB item limit.
 */
interface DocumentItem extends InvoiceDocument {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  GSI2PK: string;
  GSI2SK: string;
  GSI3PK?: string;
  GSI3SK?: string;
}

const KEY_ATTRIBUTES = [
  'PK',
  'SK',
  'GSI1PK',
  'GSI1SK',
  'GSI2PK',
  'GSI2SK',
  'GSI3PK',
  'GSI3SK',
] as const;

export class DynamoDocumentRepository implements DocumentRepository {
  readonly name = 'dynamodb' as const;

  private readonly client: DynamoDBDocumentClient;

  constructor(private readonly tableName: string) {
    this.client = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: config.aws.region }),
      { marshallOptions: { removeUndefinedValues: true } },
    );
  }

  private toItem(document: InvoiceDocument): DocumentItem {
    const item: DocumentItem = {
      ...document,
      PK: `ORG#${document.orgId}`,
      SK: `DOC#${document.documentId}`,
      GSI1PK: `ORG#${document.orgId}#STATUS#${document.status}`,
      GSI1SK: `${document.createdAt}#DOC#${document.documentId}`,
      GSI2PK: `HASH#${document.fileHash}`,
      GSI2SK: `DOC#${document.documentId}`,
    };
    if (document.fingerprint) {
      item.GSI3PK = `FP#${document.fingerprint}`;
      item.GSI3SK = `DOC#${document.documentId}`;
    }
    return item;
  }

  private toDocument(item: Record<string, unknown> | undefined): InvoiceDocument | null {
    if (!item) return null;
    const rest = { ...item };
    for (const key of KEY_ATTRIBUTES) delete rest[key];
    const parsed = documentSchema.safeParse(rest);
    if (!parsed.success) {
      logger.warn('Skipping malformed DynamoDB document', { issues: parsed.error.issues.length });
      return null;
    }
    return parsed.data;
  }

  async put(document: InvoiceDocument): Promise<InvoiceDocument> {
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: this.toItem(document) }),
    );
    return document;
  }

  async get(orgId: string, documentId: string): Promise<InvoiceDocument | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `ORG#${orgId}`, SK: `DOC#${documentId}` },
      }),
    );
    return this.toDocument(result.Item);
  }

  async list(query: ListDocumentsQuery): Promise<InvoiceDocument[]> {
    const command = query.status
      ? new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk',
          ExpressionAttributeValues: { ':pk': `ORG#${query.orgId}#STATUS#${query.status}` },
          ScanIndexForward: false,
          Limit: query.limit,
        })
      : new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': `ORG#${query.orgId}`, ':sk': 'DOC#' },
          Limit: query.limit,
        });

    const result = await this.client.send(command);
    const documents = (result.Items ?? [])
      .map((item) => this.toDocument(item))
      .filter((doc): doc is InvoiceDocument => doc !== null);

    return documents.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findByFileHash(orgId: string, fileHash: string): Promise<InvoiceDocument[]> {
    return this.queryIndex('GSI2', 'GSI2PK', `HASH#${fileHash}`, orgId);
  }

  async findByFingerprint(orgId: string, fingerprint: string): Promise<InvoiceDocument[]> {
    return this.queryIndex('GSI3', 'GSI3PK', `FP#${fingerprint}`, orgId);
  }

  private async queryIndex(
    indexName: string,
    keyName: string,
    keyValue: string,
    orgId: string,
  ): Promise<InvoiceDocument[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: indexName,
        KeyConditionExpression: `${keyName} = :pk`,
        ExpressionAttributeValues: { ':pk': keyValue },
      }),
    );
    return (result.Items ?? [])
      .map((item) => this.toDocument(item))
      .filter((doc): doc is InvoiceDocument => doc !== null && doc.orgId === orgId);
  }
}

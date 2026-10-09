import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface StoredFile {
  storageKey: string;
}

/**
 * Original invoices never go into the database and are never served from a
 * public URL. Deployed environments use a private S3 bucket with short-lived
 * signed URLs; local demos write to a gitignored folder and stream bytes
 * through the API instead.
 */
export interface StorageService {
  readonly name: 's3' | 'local';
  put(key: string, body: Buffer, contentType: string): Promise<StoredFile>;
  get(key: string): Promise<Buffer>;
  /** Returns a signed URL when the backend can mint one, otherwise null. */
  previewUrl(key: string, expiresInSeconds?: number): Promise<string | null>;
}

export class S3StorageService implements StorageService {
  readonly name = 's3' as const;

  private readonly client = new S3Client({ region: config.aws.region });

  constructor(private readonly bucket: string) {}

  async put(key: string, body: Buffer, contentType: string): Promise<StoredFile> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }),
    );
    return { storageKey: key };
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new Error(`S3 object ${key} returned no body`);
    return Buffer.from(bytes);
  }

  async previewUrl(key: string, expiresInSeconds = 300): Promise<string | null> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }
}

export class LocalStorageService implements StorageService {
  readonly name = 'local' as const;

  private readonly root: string;

  constructor(directory: string) {
    this.root = resolve(process.cwd(), directory);
  }

  /** Guards against a crafted key escaping the storage root. */
  private pathFor(key: string): string {
    const target = resolve(this.root, key);
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new Error(`Refusing to access path outside storage root: ${key}`);
    }
    return target;
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<StoredFile> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
    return { storageKey: key };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async previewUrl(): Promise<string | null> {
    // No signing possible locally; the API streams the file instead.
    return null;
  }
}

export function createStorageService(): StorageService {
  if (config.features.s3 && config.aws.s3Bucket) {
    logger.info('Using S3 storage', { bucket: config.aws.s3Bucket });
    return new S3StorageService(config.aws.s3Bucket);
  }
  logger.info('Using local disk storage', { directory: config.localStorageDir });
  return new LocalStorageService(config.localStorageDir);
}

export function documentStorageKey(orgId: string, documentId: string, fileName: string): string {
  const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
  const safeExtension = /^\.[A-Za-z0-9]{1,5}$/.test(extension) ? extension.toLowerCase() : '';
  return join('orgs', orgId, 'documents', `${documentId}${safeExtension}`).replace(/\\/g, '/');
}

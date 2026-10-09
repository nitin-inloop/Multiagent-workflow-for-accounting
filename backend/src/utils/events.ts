import { EventEmitter } from 'node:events';
import type { InvoiceDocument } from '../types/document.js';

/**
 * One in-process bus for document changes.
 *
 * Without it every open tab has to poll to discover that extraction finished,
 * which means the answer sits ready on the server for up to a full poll
 * interval before anyone sees it. With it, the SSE route forwards the change
 * the moment it is written, and polling becomes the fallback rather than the
 * mechanism.
 *
 * Deliberately in-process: a single API instance serves the demo. Scaling past
 * one instance means swapping this for Redis pub/sub or DynamoDB streams, and
 * nothing above this file would have to change.
 */

export type DocumentEventType = 'created' | 'updated';

export interface DocumentEvent {
  type: DocumentEventType;
  document: InvoiceDocument;
  at: string;
}

export type DocumentListener = (event: DocumentEvent) => void;

const CHANNEL = 'document';

class DocumentEventBus {
  private readonly emitter = new EventEmitter();
  /** Monotonic id so a reconnecting client can tell it missed nothing. */
  private sequence = 0;

  constructor() {
    // One listener per open browser tab; the default cap of 10 would warn.
    this.emitter.setMaxListeners(0);
  }

  emit(type: DocumentEventType, document: InvoiceDocument): void {
    this.sequence += 1;
    const event: DocumentEvent = { type, document, at: new Date().toISOString() };
    this.emitter.emit(CHANNEL, event);
  }

  /** Returns the unsubscribe function, which callers must run on disconnect. */
  subscribe(listener: DocumentListener): () => void {
    this.emitter.on(CHANNEL, listener);
    return () => this.emitter.off(CHANNEL, listener);
  }

  get subscribers(): number {
    return this.emitter.listenerCount(CHANNEL);
  }

  get lastSequence(): number {
    return this.sequence;
  }
}

export const documentEvents = new DocumentEventBus();

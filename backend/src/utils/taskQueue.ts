import { HttpError } from './errors.js';
import { logger } from './logger.js';

/**
 * Bounded work queue for the extraction agent.
 *
 * Fire-and-forget promises were the previous mechanism, and they have two
 * failure modes that only show up under load: twenty dropped invoices open
 * twenty concurrent Textract and Gemini calls, which the providers answer with
 * 429s so every document degrades to the sample fallback at once; and a
 * transient fault has no second chance, because nothing is holding the job.
 *
 * This queue caps how many documents are read at a time, retries the transient
 * failures with jittered backoff, and refuses to queue the same document twice.
 */

export interface TaskQueueOptions {
  name: string;
  /** How many tasks may run at once. */
  concurrency: number;
  /** Total tries per task, including the first. */
  maxAttempts?: number;
  /** First backoff step; doubles per attempt with jitter on top. */
  baseDelayMs?: number;
}

interface QueuedTask {
  key: string;
  run: () => Promise<void>;
  attempt: number;
}

export interface TaskQueueStats {
  name: string;
  active: number;
  waiting: number;
  concurrency: number;
}

export class TaskQueue {
  private readonly waiting: QueuedTask[] = [];
  /** Keys currently queued or running, so a retry click cannot double-run. */
  private readonly claimed = new Set<string>();
  private readonly idleWaiters: Array<() => void> = [];
  private active = 0;

  constructor(private readonly options: TaskQueueOptions) {}

  /**
   * Schedules a task. Returns false when this key is already queued or running,
   * which is what stops a double-clicked "read it again" from paying twice.
   */
  enqueue(key: string, run: () => Promise<void>): boolean {
    if (this.claimed.has(key)) return false;
    this.claimed.add(key);
    this.waiting.push({ key, run, attempt: 1 });
    this.pump();
    return true;
  }

  get stats(): TaskQueueStats {
    return {
      name: this.options.name,
      active: this.active,
      waiting: this.waiting.length,
      concurrency: this.options.concurrency,
    };
  }

  /** Resolves once nothing is queued or running. Used by scripts and tests. */
  async idle(): Promise<void> {
    if (this.active === 0 && this.waiting.length === 0) return;
    await new Promise<void>((resolve) => this.idleWaiters.push(resolve));
  }

  private pump(): void {
    while (this.active < this.options.concurrency && this.waiting.length > 0) {
      const task = this.waiting.shift();
      if (!task) break;
      this.active += 1;
      void this.execute(task);
    }
  }

  private async execute(task: QueuedTask): Promise<void> {
    const maxAttempts = this.options.maxAttempts ?? 1;
    try {
      await task.run();
      this.release(task.key);
    } catch (error) {
      const retryable = task.attempt < maxAttempts && isRetryable(error);
      logger.warn('Queued task failed', {
        queue: this.options.name,
        key: task.key,
        attempt: task.attempt,
        retryable,
        error: (error as Error).message,
      });

      if (!retryable) {
        this.release(task.key);
        return;
      }

      // Keep the key claimed across the wait so nothing else takes the slot.
      const delay = backoffMs(this.options.baseDelayMs ?? 400, task.attempt);
      setTimeout(() => {
        this.waiting.push({ ...task, attempt: task.attempt + 1 });
        this.pump();
      }, delay).unref();
    } finally {
      this.active -= 1;
      this.pump();
      this.settleIfIdle();
    }
  }

  private release(key: string): void {
    this.claimed.delete(key);
  }

  private settleIfIdle(): void {
    if (this.active > 0 || this.waiting.length > 0) return;
    while (this.idleWaiters.length > 0) this.idleWaiters.pop()?.();
  }
}

/** Exponential backoff with 50-100% jitter, so retries do not synchronize. */
function backoffMs(base: number, attempt: number): number {
  const ceiling = base * 2 ** (attempt - 1);
  return Math.round(ceiling * (0.5 + Math.random() * 0.5));
}

/** A 4xx is the caller's fault and will fail again; anything else may not. */
function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) return error.status >= 500;
  return true;
}

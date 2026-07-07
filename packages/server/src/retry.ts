export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Return true if the error is retryable (default: RetryableError only). */
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (attempt: number, delayMs: number, err: unknown) => void;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function isRetryableHttp(err: unknown): boolean {
  if (err instanceof HttpError) {
    return err.status === 429 || err.status >= 500;
  }
  // Network-level failures (fetch TypeError, aborts) are retryable.
  return err instanceof TypeError || (err instanceof Error && err.name === "AbortError");
}

/** Exponential backoff with full jitter. */
export function backoffDelay(attempt: number, base: number, max: number): number {
  const cap = Math.min(max, base * 2 ** attempt);
  return Math.random() * cap;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 300,
    maxDelayMs = 5_000,
    isRetryable = isRetryableHttp,
    onRetry,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryable(err)) throw err;
      const delay = backoffDelay(attempt, baseDelayMs, maxDelayMs);
      onRetry?.(attempt + 1, delay, err);
      await sleep(delay);
    }
  }
  throw lastErr;
}

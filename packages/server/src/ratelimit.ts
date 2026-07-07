/**
 * Token bucket (in-process) — used to cap outbound calls per provider.
 * Public API routes additionally use a Redis sliding window when Redis is
 * configured (see cache.ts / api routes).
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillPerSecond: number,
    private now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.lastRefill = this.now();
  }

  private refill() {
    const t = this.now();
    const elapsed = (t - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    this.lastRefill = t;
  }

  tryTake(n = 1): boolean {
    this.refill();
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    return false;
  }

  /** Milliseconds until `n` tokens will be available. */
  msUntilAvailable(n = 1): number {
    this.refill();
    if (this.tokens >= n) return 0;
    return ((n - this.tokens) / this.refillPerSecond) * 1000;
  }
}

const buckets = new Map<string, TokenBucket>();

export function bucketFor(key: string, capacity: number, refillPerSecond: number): TokenBucket {
  let b = buckets.get(key);
  if (!b) {
    b = new TokenBucket(capacity, refillPerSecond);
    buckets.set(key, b);
  }
  return b;
}

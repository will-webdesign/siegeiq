/**
 * Minimal circuit breaker. After `threshold` consecutive failures the circuit
 * opens for `cooldownMs`; while open, calls fail fast so the registry moves to
 * the next provider immediately instead of waiting on timeouts.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private threshold = 4,
    private cooldownMs = 60_000,
    private now: () => number = Date.now,
  ) {}

  get state(): "closed" | "open" | "half-open" {
    if (this.failures < this.threshold) return "closed";
    const elapsed = this.now() - this.openedAt;
    return elapsed >= this.cooldownMs ? "half-open" : "open";
  }

  canRequest(): boolean {
    return this.state !== "open";
  }

  recordSuccess(): void {
    this.failures = 0;
  }

  recordFailure(): void {
    this.failures++;
    if (this.failures === this.threshold) this.openedAt = this.now();
    // In half-open, a failure re-opens the window.
    if (this.failures > this.threshold) this.openedAt = this.now();
  }

  snapshot() {
    return { state: this.state, consecutiveFailures: this.failures };
  }
}

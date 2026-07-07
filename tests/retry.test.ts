import { describe, expect, it, vi } from "vitest";
import { HttpError, backoffDelay, isRetryableHttp, withRetry } from "@siegeiq/server/retry";
import { TokenBucket } from "@siegeiq/server/ratelimit";
import { CircuitBreaker } from "@siegeiq/server/circuit";

const noSleep = () => Promise.resolve();

describe("withRetry", () => {
  it("retries retryable errors then succeeds", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new HttpError(503, "boom");
      return "ok";
    });
    await expect(withRetry(fn, { retries: 3, sleep: noSleep })).resolves.toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry non-retryable status codes", async () => {
    const fn = vi.fn(async () => {
      throw new HttpError(404, "nope");
    });
    await expect(withRetry(fn, { retries: 3, sleep: noSleep })).rejects.toThrow("nope");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry budget", async () => {
    const fn = vi.fn(async () => {
      throw new HttpError(429, "rate");
    });
    await expect(withRetry(fn, { retries: 2, sleep: noSleep })).rejects.toThrow("rate");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("isRetryableHttp", () => {
  it("classifies correctly", () => {
    expect(isRetryableHttp(new HttpError(429, ""))).toBe(true);
    expect(isRetryableHttp(new HttpError(500, ""))).toBe(true);
    expect(isRetryableHttp(new HttpError(401, ""))).toBe(false);
    expect(isRetryableHttp(new TypeError("fetch failed"))).toBe(true);
  });
});

describe("backoffDelay", () => {
  it("is bounded by max", () => {
    for (let a = 0; a < 10; a++) {
      expect(backoffDelay(a, 300, 5000)).toBeLessThanOrEqual(5000);
    }
  });
});

describe("TokenBucket", () => {
  it("enforces capacity and refills over time", () => {
    let now = 0;
    const bucket = new TokenBucket(2, 1, () => now);
    expect(bucket.tryTake()).toBe(true);
    expect(bucket.tryTake()).toBe(true);
    expect(bucket.tryTake()).toBe(false);
    now = 1000; // +1 token
    expect(bucket.tryTake()).toBe(true);
    expect(bucket.tryTake()).toBe(false);
  });
});

describe("CircuitBreaker", () => {
  it("opens after threshold and half-opens after cooldown", () => {
    let now = 0;
    const cb = new CircuitBreaker(2, 1000, () => now);
    expect(cb.canRequest()).toBe(true);
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.state).toBe("open");
    expect(cb.canRequest()).toBe(false);
    now = 1001;
    expect(cb.state).toBe("half-open");
    expect(cb.canRequest()).toBe(true);
    cb.recordSuccess();
    expect(cb.state).toBe("closed");
  });
});

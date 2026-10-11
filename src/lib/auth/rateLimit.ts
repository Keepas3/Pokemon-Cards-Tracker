// Slows down password guessing: after `max` failures inside `windowMs`, a key (e.g. one
// address trying one profile) is refused until the oldest failure ages out. In memory, so it
// resets when the server restarts — fine for a two-person site, and scrypt is slow anyway.

export interface RateLimiter {
  /** Whether `key` may try now, and how long until it may if not. */
  check(key: string, nowMs?: number): { allowed: boolean; retryAfterMs: number };
  fail(key: string, nowMs?: number): void;
  /** Forget a key (after a successful sign-in). */
  reset(key: string): void;
}

export function createRateLimiter(opts: { max: number; windowMs: number }): RateLimiter {
  const failures = new Map<string, number[]>();

  const recent = (key: string, nowMs: number) => {
    const list = (failures.get(key) ?? []).filter((t) => nowMs - t < opts.windowMs);
    if (list.length === 0) failures.delete(key);
    else failures.set(key, list);
    return list;
  };

  return {
    check(key, nowMs = Date.now()) {
      const list = recent(key, nowMs);
      if (list.length < opts.max) return { allowed: true, retryAfterMs: 0 };
      return { allowed: false, retryAfterMs: list[0] + opts.windowMs - nowMs };
    },
    fail(key, nowMs = Date.now()) {
      const list = recent(key, nowMs);
      list.push(nowMs);
      failures.set(key, list);
      // Keep the map from growing without bound under a flood of different keys.
      if (failures.size > 5000) for (const k of failures.keys()) recent(k, nowMs);
    },
    reset(key) {
      failures.delete(key);
    },
  };
}

const WINDOW_MS = 15 * 60 * 1000;
const g = globalThis as unknown as { __authLimiters?: { perAddress: RateLimiter; perProfile: RateLimiter } };

/** Shared across hot reloads: 5 wrong passwords per address per profile, 20 per profile overall, every 15 minutes. */
export const authLimiters = (g.__authLimiters ??= {
  perAddress: createRateLimiter({ max: 5, windowMs: WINDOW_MS }),
  perProfile: createRateLimiter({ max: 20, windowMs: WINDOW_MS }),
});

/**
 * The caller's address from the forwarding headers a host sets, or "unknown". With several addresses in
 * X-Forwarded-For the *last* is the one the host's own proxy added; earlier ones are whatever the visitor sent,
 * so trusting the first would let a guesser dodge the per-address limit by inventing addresses.
 */
export function clientAddress(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((a) => a.trim()).filter(Boolean).at(-1);
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

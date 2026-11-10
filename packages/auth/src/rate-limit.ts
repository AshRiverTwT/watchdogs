/**
 * Fixed-window in-memory limiter. Enough for one web process on one EC2 box;
 * swap for a Postgres-backed one if the web tier is ever scaled out.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private limit: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** Returns true if the action is allowed, and records it. */
  take(key: string): boolean {
    const t = this.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      this.hits.set(key, { count: 1, resetAt: t + this.windowMs });
      if (this.hits.size > 10_000) this.sweep(t);
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private sweep(t: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
  }
}

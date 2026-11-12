type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

/**
 * Small, dependency-free abuse guard for a single application instance.
 * For multi-instance production deployments, replace with a shared Redis limiter.
 */
export function rateLimit(key: string, limit = 30, windowMs = 60_000): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
  }
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  return { allowed: true, retryAfter: 0 };
}

export function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

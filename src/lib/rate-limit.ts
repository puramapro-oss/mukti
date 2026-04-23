// MUKTI — In-memory rate limiter (sliding window)
// MVP : per-process sur Vercel (pas de cross-instance sync).
// G7/G8 : swap vers @upstash/ratelimit pour production multi-instance.

type Bucket = { timestamps: number[] }
const buckets = new Map<string, Bucket>()

// GC à chaque appel : supprime les buckets vides > 10 min d'inactivité
function maybeGc() {
  if (buckets.size < 5000) return
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [key, bucket] of buckets) {
    if (bucket.timestamps.length === 0 || bucket.timestamps[bucket.timestamps.length - 1] < cutoff) {
      buckets.delete(key)
    }
  }
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
  retryAfterSec: number
}

/**
 * Limite `max` requêtes par `windowSec` sur la clé.
 * La clé typique : `${route}:${ip}:${userId?}` pour granularité.
 */
export function rateLimit(key: string, max: number, windowSec: number): RateLimitResult {
  const now = Date.now()
  const windowMs = windowSec * 1000
  const cutoff = now - windowMs

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { timestamps: [] }
    buckets.set(key, bucket)
  }

  bucket.timestamps = bucket.timestamps.filter(t => t > cutoff)

  if (bucket.timestamps.length >= max) {
    const oldest = bucket.timestamps[0] ?? now
    const resetAt = oldest + windowMs
    return {
      ok: false,
      remaining: 0,
      resetAt,
      retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    }
  }

  bucket.timestamps.push(now)
  maybeGc()

  return {
    ok: true,
    remaining: max - bucket.timestamps.length,
    resetAt: now + windowMs,
    retryAfterSec: 0,
  }
}

/** Extrait une IP lisible depuis les headers Next.js (Vercel set x-forwarded-for). */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  const first = fwd.split(',')[0]?.trim()
  if (first) return first
  return req.headers.get('x-real-ip') ?? 'unknown'
}

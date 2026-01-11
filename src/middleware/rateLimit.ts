// src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import type { AuthenticatedRequest } from './auth';

/**
 * Cross-version, IPv6-safe key generator.
 * Uses express-rate-limit's internal ipKeyGenerator if available,
 * otherwise falls back to req.ip / X-Forwarded-For.
 */
function ipv6SafeKey(req: Request): string {
  const anyRL = rateLimit as any;
  if (anyRL && typeof anyRL.ipKeyGenerator === 'function') {
    // v7+ exposes ipKeyGenerator on the default export (not as a named export in some builds)
    return anyRL.ipKeyGenerator(req);
  }
  // Fallback: keep it reasonable if ipKeyGenerator isn’t present
  const xfwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return req.ip || xfwd || 'unknown';
}

/**
 * Per-IP limiter: 60 req/min
 */
export const perIp60rpm = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipv6SafeKey(req),
});

/**
 * Per-IP limiter for redirects: 600 req/min.
 */
export const perIp600rpm = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipv6SafeKey(req),
});

/**
 * Per-User limiter: 120 req/min.
 * Keys by authenticated userId; falls back to IPv6-safe IP key.
 * Requires auth middleware to set req.user = { userId: string, ... }.
 */
export const perUser120rpm = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req as AuthenticatedRequest).user?.userId;
    return userId ? `user:${userId}` : ipv6SafeKey(req);
  },
});

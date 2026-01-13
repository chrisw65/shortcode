// src/middleware/redisRateLimit.ts
import type { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import redisClient from '../config/redis';
import { getOrgLimits } from '../services/orgLimits';
import type { AuthenticatedRequest } from './auth';
import type { OrgRequest } from './org';

function ipv6SafeKey(req: Request): string {
  const cfip = (req.headers['cf-connecting-ip'] as string | undefined)?.trim();
  const xfwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return cfip || xfwd || req.ip || 'unknown';
}

function authKey(req: Request): string {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const ip = ipv6SafeKey(req);
  return email ? `auth:${email}:${ip}` : ip;
}

function buildLimiter(points: number, duration: number, prefix: string) {
  const memory = new RateLimiterMemory({ points, duration, keyPrefix: `${prefix}:mem` });
  const redis = new RateLimiterRedis({
    storeClient: redisClient as any,
    points,
    duration,
    keyPrefix: prefix,
  });
  return { redis, memory };
}

function makeMiddleware(
  points: number,
  duration: number,
  prefix: string,
  keyer: (req: Request) => string,
  mode: 'json' | 'text'
) {
  const limiter = buildLimiter(points, duration, prefix);
  const setRateHeaders = (res: Response, remaining: number, msBeforeNext: number) => {
    const reset = Math.ceil((Date.now() + msBeforeNext) / 1000);
    res.setHeader('X-RateLimit-Limit', String(points));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
    res.setHeader('X-RateLimit-Reset', String(reset));
    if (msBeforeNext > 0) {
      res.setHeader('Retry-After', String(Math.ceil(msBeforeNext / 1000)));
    }
  };
  return async (req: Request, res: Response, next: NextFunction) => {
    const bypassToken = process.env.RATE_LIMIT_BYPASS_TOKEN;
    if (bypassToken && req.headers['x-rate-bypass'] === bypassToken) {
      return next();
    }
    const key = keyer(req);
    const useRedis = redisClient.isReady;
    try {
      const result = await (useRedis ? limiter.redis : limiter.memory).consume(key);
      setRateHeaders(res, result.remainingPoints ?? 0, result.msBeforeNext ?? 0);
      return next();
    } catch (err) {
      const meta = err && typeof err === 'object' ? (err as { remainingPoints?: number; msBeforeNext?: number }) : {};
      const remaining = meta.remainingPoints ?? 0;
      const msBeforeNext = meta.msBeforeNext ?? Math.ceil(duration * 1000);
      setRateHeaders(res, remaining, msBeforeNext);
      if (mode === 'json') {
        return res.status(429).json({ success: false, error: 'Too many requests' });
      }
      return res.status(429).send('Too many requests');
    }
  };
}

const testFactor = Number(process.env.RATE_LIMIT_TEST_FACTOR || '1');
const safeFactor = Number.isFinite(testFactor) && testFactor > 0 ? testFactor : 1;
const scaled = (points: number) => Math.max(1, Math.round(points * safeFactor));

const redirectRpm = Number(process.env.RATE_LIMIT_REDIRECT_RPM || '6000');
const safeRedirectRpm = Number.isFinite(redirectRpm) && redirectRpm > 0 ? redirectRpm : 6000;

export const perIp600rpmRedis = makeMiddleware(scaled(600), 60, 'rl:ip:600', (req) => ipv6SafeKey(req), 'text');
export const perIpRedirectRpmRedis = makeMiddleware(
  scaled(safeRedirectRpm),
  60,
  'rl:ip:redirect',
  (req) => ipv6SafeKey(req),
  'text'
);

export const perIp60rpmRedis = makeMiddleware(scaled(60), 60, 'rl:ip:60', (req) => ipv6SafeKey(req), 'json');

export const perIp20rpmRedis = makeMiddleware(scaled(20), 60, 'rl:ip:20', (req) => ipv6SafeKey(req), 'json');

export const perAuth300rpmRedis = makeMiddleware(scaled(300), 60, 'rl:auth:300', (req) => authKey(req), 'json');

export const perUser120rpmRedis = makeMiddleware(
  scaled(120),
  60,
  'rl:user:120',
  (req) => {
    const userId = (req as AuthenticatedRequest).user?.userId;
    return userId ? `user:${userId}` : ipv6SafeKey(req);
  },
  'json'
);

const orgLimiterCache = new Map<number, ReturnType<typeof buildLimiter>>();

function getOrgLimiter(points: number) {
  const existing = orgLimiterCache.get(points);
  if (existing) return existing;
  const limiter = buildLimiter(points, 60, `rl:org:${points}`);
  orgLimiterCache.set(points, limiter);
  return limiter;
}

export async function perOrgApiRpmRedis(req: Request, res: Response, next: NextFunction) {
  const bypassToken = process.env.RATE_LIMIT_BYPASS_TOKEN;
  if (bypassToken && req.headers['x-rate-bypass'] === bypassToken) {
    return next();
  }
  const orgId = (req as OrgRequest).org?.orgId;
  if (!orgId) return next();

  try {
    const limits = await getOrgLimits(orgId);
    const points = scaled(limits.apiRateLimitRpm);
    const limiter = getOrgLimiter(points);
    const key = `org:${orgId}`;
    const useRedis = redisClient.isReady;
    const result = await (useRedis ? limiter.redis : limiter.memory).consume(key);
    const reset = Math.ceil((Date.now() + (result.msBeforeNext ?? 0)) / 1000);
    res.setHeader('X-RateLimit-Limit', String(points));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, result.remainingPoints ?? 0)));
    res.setHeader('X-RateLimit-Reset', String(reset));
    return next();
  } catch (err) {
    const meta = err && typeof err === 'object' ? (err as { remainingPoints?: number; msBeforeNext?: number }) : {};
    const msBeforeNext = meta.msBeforeNext ?? 60_000;
    const remaining = meta.remainingPoints ?? 0;
    const reset = Math.ceil((Date.now() + msBeforeNext) / 1000);
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
    res.setHeader('X-RateLimit-Reset', String(reset));
    if (msBeforeNext > 0) {
      res.setHeader('Retry-After', String(Math.ceil(msBeforeNext / 1000)));
    }
    return res.status(429).json({ success: false, error: 'Too many requests' });
  }
}

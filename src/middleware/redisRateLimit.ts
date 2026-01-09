// src/middleware/redisRateLimit.ts
import type { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import redisClient from '../config/redis';

function ipv6SafeKey(req: Request): string {
  const cfip = (req.headers['cf-connecting-ip'] as string | undefined)?.trim();
  const xfwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return cfip || xfwd || req.ip || 'unknown';
}

function authKey(req: Request): string {
  const email = String((req as any)?.body?.email || '').trim().toLowerCase();
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
  return async (req: Request, res: Response, next: NextFunction) => {
    const bypassToken = process.env.RATE_LIMIT_BYPASS_TOKEN;
    if (bypassToken && req.headers['x-rate-bypass'] === bypassToken) {
      return next();
    }
    const key = keyer(req);
    const useRedis = redisClient.isReady;
    try {
      await (useRedis ? limiter.redis : limiter.memory).consume(key);
      return next();
    } catch {
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

export const perIp600rpmRedis = makeMiddleware(scaled(600), 60, 'rl:ip:600', (req) => ipv6SafeKey(req), 'text');

export const perIp60rpmRedis = makeMiddleware(scaled(60), 60, 'rl:ip:60', (req) => ipv6SafeKey(req), 'json');

export const perIp20rpmRedis = makeMiddleware(scaled(20), 60, 'rl:ip:20', (req) => ipv6SafeKey(req), 'json');

export const perAuth300rpmRedis = makeMiddleware(scaled(300), 60, 'rl:auth:300', (req) => authKey(req), 'json');

export const perUser120rpmRedis = makeMiddleware(
  scaled(120),
  60,
  'rl:user:120',
  (req) => {
    const userId = (req as any)?.user?.userId as string | undefined;
    return userId ? `user:${userId}` : ipv6SafeKey(req);
  },
  'json'
);

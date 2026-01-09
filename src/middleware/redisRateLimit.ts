// src/middleware/redisRateLimit.ts
import type { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import redisClient from '../config/redis';

function ipv6SafeKey(req: Request): string {
  const xfwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return req.ip || xfwd || 'unknown';
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

export const perIp600rpmRedis = makeMiddleware(600, 60, 'rl:ip:600', (req) => ipv6SafeKey(req), 'text');

export const perIp60rpmRedis = makeMiddleware(60, 60, 'rl:ip:60', (req) => ipv6SafeKey(req), 'json');

export const perUser120rpmRedis = makeMiddleware(
  120,
  60,
  'rl:user:120',
  (req) => {
    const userId = (req as any)?.user?.userId as string | undefined;
    return userId ? `user:${userId}` : ipv6SafeKey(req);
  },
  'json'
);

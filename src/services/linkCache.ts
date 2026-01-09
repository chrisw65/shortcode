// src/services/linkCache.ts
import redisClient from '../config/redis';

const KEY_PREFIX = 'shortlink:link:';
const DEFAULT_TTL_SECONDS = 3600;

export type CachedLink = {
  id: string;
  original_url: string;
  expires_at: string | null;
  active: boolean;
};

function keyFor(code: string) {
  return `${KEY_PREFIX}${code}`;
}

export async function getCachedLink(code: string): Promise<CachedLink | null> {
  if (!redisClient.isReady) return null;
  try {
    const raw = await redisClient.get(keyFor(code));
    if (!raw) return null;
    return JSON.parse(raw) as CachedLink;
  } catch {
    return null;
  }
}

export async function setCachedLink(code: string, data: CachedLink, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!redisClient.isReady) return;
  try {
    await redisClient.set(keyFor(code), JSON.stringify(data), { EX: ttlSeconds });
  } catch {
    // best-effort
  }
}

export async function invalidateCachedLinks(codes: string[]) {
  if (!redisClient.isReady || !codes.length) return;
  try {
    await redisClient.del(codes.map((c) => keyFor(c)));
  } catch {
    // best-effort
  }
}

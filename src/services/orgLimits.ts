import db from '../config/database';
import { getOrgEntitlements } from './entitlements';

type OrgLimits = {
  apiRateLimitRpm: number;
  linkLimit: number | null;
  domainLimit: number | null;
};

const cache = new Map<string, { value: OrgLimits; expiresAt: number }>();
const TTL_MS = 60_000;

function defaultApiRpm() {
  const raw = Number(process.env.ORG_API_RPM_DEFAULT || '120');
  return Number.isFinite(raw) && raw > 0 ? raw : 120;
}

function normalizeLimit(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

export async function getOrgLimits(orgId: string): Promise<OrgLimits> {
  const cached = cache.get(orgId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const { rows } = await db.query(
    `SELECT api_rate_limit_rpm, link_limit, domain_limit
       FROM orgs
      WHERE id = $1
      LIMIT 1`,
    [orgId]
  );

  const row = rows[0] || {};
  const entitlements = await getOrgEntitlements(orgId);
  const entLimits = entitlements?.limits || {};
  const apiRate = normalizeLimit(row.api_rate_limit_rpm) || entLimits.api_rate_rpm || defaultApiRpm();
  const linkLimit = normalizeLimit(row.link_limit) ?? (entLimits.links ?? null);
  const domainLimit = normalizeLimit(row.domain_limit) ?? (entLimits.domains ?? null);

  const value = { apiRateLimitRpm: apiRate, linkLimit, domainLimit };
  cache.set(orgId, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export function clearOrgLimitCache(orgId: string) {
  cache.delete(orgId);
}

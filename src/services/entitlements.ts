import db from '../config/database';
import { getOrgPlan } from './plan';

export type PlanFeatures = {
  custom_domains: boolean;
  api_keys: boolean;
  webhooks: boolean;
  integrations: boolean;
  bulk_links: boolean;
  variants: boolean;
  routes: boolean;
  deep_links: boolean;
  tags: boolean;
  groups: boolean;
};

export type PlanLimits = {
  links: number | null;
  domains: number | null;
  team_seats: number | null;
  retention_days: number | null;
  api_rate_rpm: number | null;
};

export type PlanEntitlements = {
  features: PlanFeatures;
  limits: PlanLimits;
};

const DEFAULT_ENTITLEMENTS: Record<string, PlanEntitlements> = {
  free: {
    features: {
      custom_domains: false,
      api_keys: false,
      webhooks: false,
      integrations: false,
      bulk_links: false,
      variants: false,
      routes: false,
      deep_links: false,
      tags: false,
      groups: false,
    },
    limits: {
      links: 10,
      domains: 0,
      team_seats: 1,
      retention_days: 7,
      api_rate_rpm: 120,
    },
  },
  starter: {
    features: {
      custom_domains: true,
      api_keys: true,
      webhooks: true,
      integrations: true,
      bulk_links: true,
      variants: false,
      routes: false,
      deep_links: false,
      tags: true,
      groups: true,
    },
    limits: {
      links: 1000,
      domains: 1,
      team_seats: 3,
      retention_days: 30,
      api_rate_rpm: 600,
    },
  },
  pro: {
    features: {
      custom_domains: true,
      api_keys: true,
      webhooks: true,
      integrations: true,
      bulk_links: true,
      variants: true,
      routes: true,
      deep_links: true,
      tags: true,
      groups: true,
    },
    limits: {
      links: 10000,
      domains: 5,
      team_seats: 10,
      retention_days: 365,
      api_rate_rpm: 2000,
    },
  },
  enterprise: {
    features: {
      custom_domains: true,
      api_keys: true,
      webhooks: true,
      integrations: true,
      bulk_links: true,
      variants: true,
      routes: true,
      deep_links: true,
      tags: true,
      groups: true,
    },
    limits: {
      links: null,
      domains: null,
      team_seats: null,
      retention_days: null,
      api_rate_rpm: null,
    },
  },
};

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeLimit(value: unknown, fallback: number | null) {
  if (value === null) return null;
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return null;
  return Math.floor(parsed);
}

function mergeEntitlements(base: PlanEntitlements, override?: Partial<PlanEntitlements>): PlanEntitlements {
  const features = { ...base.features } as PlanFeatures;
  const limits = { ...base.limits } as PlanLimits;
  const overrideFeatures = override?.features || {};
  const overrideLimits = override?.limits || {};

  (Object.keys(features) as Array<keyof PlanFeatures>).forEach((key) => {
    features[key] = normalizeBoolean(overrideFeatures[key], features[key]);
  });
  (Object.keys(limits) as Array<keyof PlanLimits>).forEach((key) => {
    limits[key] = normalizeLimit(overrideLimits[key], limits[key]);
  });

  return { features, limits };
}

async function getBillingEntitlements(): Promise<Record<string, PlanEntitlements>> {
  try {
    const { rows } = await db.query(`SELECT value FROM site_settings WHERE key = $1 LIMIT 1`, ['billing_config']);
    const entitlements = rows[0]?.value?.entitlements as Record<string, PlanEntitlements> | undefined;
    if (!entitlements || typeof entitlements !== 'object') return {};
    return entitlements;
  } catch {
    return {};
  }
}

export async function getPlanEntitlements(planId: string): Promise<PlanEntitlements> {
  const normalized = String(planId || 'free').toLowerCase();
  const base = DEFAULT_ENTITLEMENTS[normalized] || DEFAULT_ENTITLEMENTS.free;
  const overrides = await getBillingEntitlements();
  const override = overrides?.[normalized];
  return mergeEntitlements(base, override);
}

export async function getOrgEntitlements(orgId: string): Promise<PlanEntitlements> {
  const plan = await getOrgPlan(orgId);
  return getPlanEntitlements(plan || 'free');
}

export function isFeatureEnabled(entitlements: PlanEntitlements, feature: keyof PlanFeatures): boolean {
  return Boolean(entitlements?.features?.[feature]);
}

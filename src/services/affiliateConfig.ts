// src/services/affiliateConfig.ts
import db from '../config/database';

export type AffiliateConfig = {
  default_payout_type: 'percent' | 'flat';
  default_payout_rate: number;
  payout_hold_days: number;
  free_signup_points: number;
  free_signup_points_expiry_days: number;
  allow_affiliate_coupons: boolean;
  coupon_max_percent_off: number;
  coupon_max_duration_months: number;
  coupon_default_max_redemptions: number;
};

const DEFAULT_AFFILIATE_CONFIG: AffiliateConfig = {
  default_payout_type: 'percent',
  default_payout_rate: 30,
  payout_hold_days: 14,
  free_signup_points: 1,
  free_signup_points_expiry_days: 180,
  allow_affiliate_coupons: true,
  coupon_max_percent_off: 30,
  coupon_max_duration_months: 3,
  coupon_default_max_redemptions: 100,
};

export async function getAffiliateConfig(): Promise<AffiliateConfig> {
  try {
    const { rows } = await db.query(`SELECT value FROM site_settings WHERE key = $1 LIMIT 1`, ['affiliate_config']);
    return { ...DEFAULT_AFFILIATE_CONFIG, ...(rows[0]?.value || {}) };
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
    if (code === '42P01') return DEFAULT_AFFILIATE_CONFIG;
    throw err;
  }
}

export async function updateAffiliateConfig(patch: Partial<AffiliateConfig>): Promise<AffiliateConfig> {
  const existing = await getAffiliateConfig();
  const merged: AffiliateConfig = { ...existing, ...patch };
  await db.query(
    `INSERT INTO site_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    ['affiliate_config', JSON.stringify(merged)],
  );
  return merged;
}

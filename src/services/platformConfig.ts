import db from '../config/database';

export type PlatformConfig = {
  retention_default_days?: number | null;
  ui_mode?: 'beginner' | 'expert';
};

const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  retention_default_days: null,
  ui_mode: 'beginner',
};

export async function getPlatformConfigRaw(): Promise<PlatformConfig> {
  try {
    const { rows } = await db.query(`SELECT value FROM site_settings WHERE key = $1 LIMIT 1`, ['platform_config']);
    return { ...DEFAULT_PLATFORM_CONFIG, ...(rows[0]?.value || {}) };
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
    if (code === '42P01') return DEFAULT_PLATFORM_CONFIG;
    throw err;
  }
}

export function mergePlatformConfig(existing: PlatformConfig, patch: PlatformConfig): PlatformConfig {
  return { ...existing, ...patch };
}

export function normalizeRetentionDays(value: any): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) return null;
  return parsed;
}

export function normalizeUiMode(value: any): 'beginner' | 'expert' | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const mode = String(value).toLowerCase();
  if (mode === 'beginner' || mode === 'expert') return mode;
  return null;
}

export async function getRetentionDefaultDays(): Promise<number | null> {
  const config = await getPlatformConfigRaw();
  return normalizeRetentionDays(config.retention_default_days ?? null);
}

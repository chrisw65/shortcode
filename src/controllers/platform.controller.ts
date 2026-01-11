import type { Request, Response } from 'express';
import db from '../config/database';
import {
  getPlatformConfigRaw,
  mergePlatformConfig,
  normalizeRetentionDays,
} from '../services/platformConfig';
import { log } from '../utils/logger';

export async function getPlatformConfig(_req: Request, res: Response) {
  try {
    const config = await getPlatformConfigRaw();
    return res.json({ success: true, data: config });
  } catch (err) {
    log('error', 'platform.getConfig error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updatePlatformConfig(req: Request, res: Response) {
  try {
    const payload = req.body ?? {};
    if (typeof payload !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }
    const existing = await getPlatformConfigRaw();
    const retention = normalizeRetentionDays(payload.retention_default_days);
    if (payload.retention_default_days !== undefined && payload.retention_default_days !== null && retention === null) {
      return res.status(400).json({ success: false, error: 'retention_default_days must be 1-3650 or null' });
    }
    const merged = mergePlatformConfig(existing, {
      retention_default_days: payload.retention_default_days === null ? null : retention ?? existing.retention_default_days ?? null,
    });

    await db.query(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      ['platform_config', JSON.stringify(merged)],
    );

    return res.json({ success: true, data: merged });
  } catch (err) {
    log('error', 'platform.updateConfig error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

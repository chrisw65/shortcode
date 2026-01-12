import type { Response } from 'express';
import type { OrgRequest } from '../middleware/org';
import db from '../config/database';
import { log } from '../utils/logger';
import { getEffectivePlan } from '../services/plan';
import { getPlanEntitlements, isFeatureEnabled } from '../services/entitlements';

function normalizePlatform(value: unknown) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'ios' || raw === 'android') return raw;
  return '';
}

function normalizeUrl(value: unknown) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function listMobileApps(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const plan = await getEffectivePlan(req.user?.userId || '', orgId);
    const entitlements = await getPlanEntitlements(plan);
    if (!isFeatureEnabled(entitlements, 'mobile_apps')) {
      return res.status(403).json({ success: false, error: 'Mobile apps require an upgraded plan' });
    }
    const { rows } = await db.query(
      `SELECT id, name, platform, bundle_id, package_name, app_store_url, scheme, universal_link_domain,
              is_active, created_at, updated_at
         FROM mobile_apps
        WHERE org_id = $1
        ORDER BY created_at DESC`,
      [orgId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'mobileApps.list error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createMobileApp(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const userId = req.user?.userId ?? null;
    const plan = await getEffectivePlan(req.user?.userId || '', orgId);
    const entitlements = await getPlanEntitlements(plan);
    if (!isFeatureEnabled(entitlements, 'mobile_apps')) {
      return res.status(403).json({ success: false, error: 'Mobile apps require an upgraded plan' });
    }
    const name = String(req.body?.name || '').trim();
    const platform = normalizePlatform(req.body?.platform);
    const bundleId = String(req.body?.bundle_id || '').trim();
    const packageName = String(req.body?.package_name || '').trim();
    const appStoreUrl = normalizeUrl(req.body?.app_store_url);
    const scheme = String(req.body?.scheme || '').trim();
    const universalDomain = String(req.body?.universal_link_domain || '').trim().toLowerCase();
    const isActive = req.body?.is_active !== false;

    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    if (!platform) return res.status(400).json({ success: false, error: 'platform must be ios or android' });
    if (req.body?.app_store_url && !appStoreUrl) {
      return res.status(400).json({ success: false, error: 'app_store_url must be http(s)' });
    }

    const { rows } = await db.query(
      `INSERT INTO mobile_apps
        (org_id, user_id, name, platform, bundle_id, package_name, app_store_url, scheme, universal_link_domain, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, platform, bundle_id, package_name, app_store_url, scheme, universal_link_domain,
                 is_active, created_at, updated_at`,
      [orgId, userId, name, platform, bundleId || null, packageName || null, appStoreUrl, scheme || null, universalDomain || null, isActive]
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
    if (code === '23505') {
      return res.status(409).json({ success: false, error: 'App already exists for this platform' });
    }
    log('error', 'mobileApps.create error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateMobileApp(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const { id } = req.params;
    const plan = await getEffectivePlan(req.user?.userId || '', orgId);
    const entitlements = await getPlanEntitlements(plan);
    if (!isFeatureEnabled(entitlements, 'mobile_apps')) {
      return res.status(403).json({ success: false, error: 'Mobile apps require an upgraded plan' });
    }

    const name = req.body?.name ? String(req.body.name).trim() : null;
    const platform = req.body?.platform ? normalizePlatform(req.body.platform) : null;
    const bundleId = req.body?.bundle_id ? String(req.body.bundle_id).trim() : null;
    const packageName = req.body?.package_name ? String(req.body.package_name).trim() : null;
    const appStoreUrl = req.body?.app_store_url ? normalizeUrl(req.body.app_store_url) : null;
    const scheme = req.body?.scheme ? String(req.body.scheme).trim() : null;
    const universalDomain = req.body?.universal_link_domain ? String(req.body.universal_link_domain).trim().toLowerCase() : null;
    const isActive = typeof req.body?.is_active === 'boolean' ? req.body.is_active : null;

    if (req.body?.platform && !platform) {
      return res.status(400).json({ success: false, error: 'platform must be ios or android' });
    }
    if (req.body?.app_store_url && !appStoreUrl) {
      return res.status(400).json({ success: false, error: 'app_store_url must be http(s)' });
    }

    const { rows } = await db.query(
      `UPDATE mobile_apps
          SET name = COALESCE($1, name),
              platform = COALESCE($2, platform),
              bundle_id = COALESCE($3, bundle_id),
              package_name = COALESCE($4, package_name),
              app_store_url = COALESCE($5, app_store_url),
              scheme = COALESCE($6, scheme),
              universal_link_domain = COALESCE($7, universal_link_domain),
              is_active = COALESCE($8, is_active),
              updated_at = NOW()
        WHERE org_id = $9 AND id = $10
        RETURNING id, name, platform, bundle_id, package_name, app_store_url, scheme, universal_link_domain,
                  is_active, created_at, updated_at`,
      [name, platform, bundleId, packageName, appStoreUrl, scheme, universalDomain, isActive, orgId, id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'App not found' });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
    if (code === '23505') {
      return res.status(409).json({ success: false, error: 'App already exists for this platform' });
    }
    log('error', 'mobileApps.update error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function deleteMobileApp(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const { id } = req.params;
    const plan = await getEffectivePlan(req.user?.userId || '', orgId);
    const entitlements = await getPlanEntitlements(plan);
    if (!isFeatureEnabled(entitlements, 'mobile_apps')) {
      return res.status(403).json({ success: false, error: 'Mobile apps require an upgraded plan' });
    }

    const result = await db.query(`DELETE FROM mobile_apps WHERE org_id = $1 AND id = $2`, [orgId, id]);
    return res.json({ success: true, data: { deleted: (result.rowCount ?? 0) > 0 } });
  } catch (err) {
    log('error', 'mobileApps.delete error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

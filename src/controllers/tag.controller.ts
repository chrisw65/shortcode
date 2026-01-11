import type { Response } from 'express';
import type { OrgRequest } from '../middleware/org';
import db from '../config/database';
import { logAudit } from '../services/audit';
import { log } from '../utils/logger';
import { getEffectivePlan } from '../services/plan';
import { getPlanEntitlements, isFeatureEnabled } from '../services/entitlements';

function normalizeName(value: any): string {
  return String(value || '').trim();
}

export async function listTags(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const plan = await getEffectivePlan(req.user?.userId || '', orgId);
    const entitlements = await getPlanEntitlements(plan);
    if (!isFeatureEnabled(entitlements, 'tags')) {
      return res.status(403).json({ success: false, error: 'Tags require an upgraded plan' });
    }
    const { rows } = await db.query(
      `SELECT id, name, color, created_at, updated_at
         FROM link_tags
        WHERE org_id = $1
        ORDER BY name ASC`,
      [orgId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'tags.list error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createTag(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const userId = req.user?.userId ?? null;
    const plan = await getEffectivePlan(userId || '', orgId);
    const entitlements = await getPlanEntitlements(plan);
    if (!isFeatureEnabled(entitlements, 'tags')) {
      return res.status(403).json({ success: false, error: 'Tags require an upgraded plan' });
    }
    const name = normalizeName(req.body?.name);
    const color = normalizeName(req.body?.color);
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    if (name.length > 80) return res.status(400).json({ success: false, error: 'name is too long' });
    if (color && color.length > 24) return res.status(400).json({ success: false, error: 'color is too long' });

    const { rows } = await db.query(
      `INSERT INTO link_tags (org_id, name, color, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, color, created_at, updated_at`,
      [orgId, name, color || null, userId]
    );

    await logAudit({
      org_id: orgId,
      user_id: userId,
      action: 'tag.create',
      entity_type: 'tag',
      entity_id: rows[0].id,
      metadata: { name, color: color || null },
    });

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
    if (code === '23505') {
      return res.status(409).json({ success: false, error: 'Tag already exists' });
    }
    log('error', 'tags.create error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateTag(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const userId = req.user?.userId ?? null;
    const plan = await getEffectivePlan(userId || '', orgId);
    const entitlements = await getPlanEntitlements(plan);
    if (!isFeatureEnabled(entitlements, 'tags')) {
      return res.status(403).json({ success: false, error: 'Tags require an upgraded plan' });
    }
    const { id } = req.params;
    const name = normalizeName(req.body?.name);
    const color = normalizeName(req.body?.color);
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    if (name.length > 80) return res.status(400).json({ success: false, error: 'name is too long' });
    if (color && color.length > 24) return res.status(400).json({ success: false, error: 'color is too long' });

    const { rows } = await db.query(
      `UPDATE link_tags
          SET name = $1,
              color = $2,
              updated_at = NOW()
        WHERE id = $3 AND org_id = $4
        RETURNING id, name, color, created_at, updated_at`,
      [name, color || null, id, orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Tag not found' });

    await logAudit({
      org_id: orgId,
      user_id: userId,
      action: 'tag.update',
      entity_type: 'tag',
      entity_id: rows[0].id,
      metadata: { name, color: color || null },
    });

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
    if (code === '23505') {
      return res.status(409).json({ success: false, error: 'Tag already exists' });
    }
    log('error', 'tags.update error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function deleteTag(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const userId = req.user?.userId ?? null;
    const plan = await getEffectivePlan(userId || '', orgId);
    const entitlements = await getPlanEntitlements(plan);
    if (!isFeatureEnabled(entitlements, 'tags')) {
      return res.status(403).json({ success: false, error: 'Tags require an upgraded plan' });
    }
    const { id } = req.params;

    const { rows } = await db.query(
      `DELETE FROM link_tags WHERE id = $1 AND org_id = $2
       RETURNING id, name`,
      [id, orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Tag not found' });

    await logAudit({
      org_id: orgId,
      user_id: userId,
      action: 'tag.delete',
      entity_type: 'tag',
      entity_id: rows[0].id,
      metadata: { name: rows[0].name },
    });

    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    log('error', 'tags.delete error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

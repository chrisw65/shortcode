import type { Response } from 'express';
import type { OrgRequest } from '../middleware/org';
import db from '../config/database';
import { logAudit } from '../services/audit';
import { log } from '../utils/logger';

function normalizeName(value: any): string {
  return String(value || '').trim();
}

export async function listGroups(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const { rows } = await db.query(
      `SELECT id, name, description, created_at, updated_at
         FROM link_groups
        WHERE org_id = $1
        ORDER BY name ASC`,
      [orgId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'groups.list error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createGroup(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const userId = req.user?.userId ?? null;
    const name = normalizeName(req.body?.name);
    const description = normalizeName(req.body?.description);
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    if (name.length > 120) return res.status(400).json({ success: false, error: 'name is too long' });

    const { rows } = await db.query(
      `INSERT INTO link_groups (org_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, created_at, updated_at`,
      [orgId, name, description || null, userId]
    );

    await logAudit({
      org_id: orgId,
      user_id: userId,
      action: 'group.create',
      entity_type: 'group',
      entity_id: rows[0].id,
      metadata: { name },
    });

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ success: false, error: 'Group already exists' });
    }
    log('error', 'groups.create error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateGroup(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const userId = req.user?.userId ?? null;
    const { id } = req.params;
    const name = normalizeName(req.body?.name);
    const description = normalizeName(req.body?.description);
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    if (name.length > 120) return res.status(400).json({ success: false, error: 'name is too long' });

    const { rows } = await db.query(
      `UPDATE link_groups
          SET name = $1,
              description = $2,
              updated_at = NOW()
        WHERE id = $3 AND org_id = $4
        RETURNING id, name, description, created_at, updated_at`,
      [name, description || null, id, orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Group not found' });

    await logAudit({
      org_id: orgId,
      user_id: userId,
      action: 'group.update',
      entity_type: 'group',
      entity_id: rows[0].id,
      metadata: { name },
    });

    return res.json({ success: true, data: rows[0] });
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ success: false, error: 'Group already exists' });
    }
    log('error', 'groups.update error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function deleteGroup(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const userId = req.user?.userId ?? null;
    const { id } = req.params;

    const { rows } = await db.query(
      `DELETE FROM link_groups WHERE id = $1 AND org_id = $2
       RETURNING id, name`,
      [id, orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Group not found' });

    await logAudit({
      org_id: orgId,
      user_id: userId,
      action: 'group.delete',
      entity_type: 'group',
      entity_id: rows[0].id,
      metadata: { name: rows[0].name },
    });

    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    log('error', 'groups.delete error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

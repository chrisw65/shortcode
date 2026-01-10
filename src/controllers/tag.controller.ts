import type { Response } from 'express';
import type { OrgRequest } from '../middleware/org';
import db from '../config/database';
import { logAudit } from '../services/audit';

function normalizeName(value: any): string {
  return String(value || '').trim();
}

export async function listTags(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const { rows } = await db.query(
      `SELECT id, name, color, created_at, updated_at
         FROM link_tags
        WHERE org_id = $1
        ORDER BY name ASC`,
      [orgId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('tags.list error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createTag(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const userId = req.user?.userId ?? null;
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
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ success: false, error: 'Tag already exists' });
    }
    console.error('tags.create error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateTag(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const userId = req.user?.userId ?? null;
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
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ success: false, error: 'Tag already exists' });
    }
    console.error('tags.update error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function deleteTag(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const userId = req.user?.userId ?? null;
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
    console.error('tags.delete error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

import type { Response } from 'express';
import db from '../config/database';
import type { OrgRequest } from '../middleware/org';
import { log } from '../utils/logger';

export async function listAuditLogs(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const limitRaw = Number(req.query.limit || 100);
    const offsetRaw = Number(req.query.offset || 0);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const { rows } = await db.query(
      `SELECT l.id, l.action, l.entity_type, l.entity_id, l.metadata, l.created_at,
              u.email AS user_email, u.name AS user_name
         FROM audit_logs l
         LEFT JOIN users u ON u.id = l.user_id
        WHERE l.org_id = $1
        ORDER BY l.created_at DESC
        LIMIT $2 OFFSET $3`,
      [orgId, limit, offset]
    );

    const countRes = await db.query(
      `SELECT COUNT(*)::int AS total FROM audit_logs WHERE org_id = $1`,
      [orgId]
    );

    return res.json({ success: true, data: rows, meta: { total: countRes.rows[0]?.total || 0, limit, offset } });
  } catch (e) {
    log('error', 'audit.list error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function exportAuditLogs(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const { rows } = await db.query(
      `SELECT l.id, l.action, l.entity_type, l.entity_id, l.metadata, l.created_at,
              u.email AS user_email, u.name AS user_name
         FROM audit_logs l
         LEFT JOIN users u ON u.id = l.user_id
        WHERE l.org_id = $1
        ORDER BY l.created_at DESC`,
      [orgId]
    );

    const lines = [
      'id,action,entity_type,entity_id,user_email,user_name,created_at,metadata',
    ];
    const esc = (value: any) => {
      const raw = value === null || value === undefined ? '' : String(value);
      const safe = raw.replace(/"/g, '""');
      return `"${safe}"`;
    };
    rows.forEach((row) => {
      lines.push([
        esc(row.id),
        esc(row.action),
        esc(row.entity_type),
        esc(row.entity_id || ''),
        esc(row.user_email || ''),
        esc(row.user_name || ''),
        esc(row.created_at?.toISOString ? row.created_at.toISOString() : row.created_at),
        esc(JSON.stringify(row.metadata || {})),
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    return res.send(lines.join('\n'));
  } catch (e) {
    log('error', 'audit.export error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

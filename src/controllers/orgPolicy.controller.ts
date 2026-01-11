import type { Response } from 'express';
import type { OrgRequest } from '../middleware/org';
import db from '../config/database';
import { logAudit } from '../services/audit';
import { log } from '../utils/logger';

export async function getOrgPolicy(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const { rows } = await db.query(
      `SELECT id, require_sso, created_at, updated_at
         FROM org_policies
        WHERE org_id = $1
        LIMIT 1`,
      [orgId]
    );
    if (!rows.length) {
      return res.json({ success: true, data: { require_sso: false } });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (e) {
    log('error', 'orgPolicy.get error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateOrgPolicy(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const actorId = req.user?.userId ?? null;
    const requireSso = Boolean(req.body?.require_sso);

    if (requireSso) {
      const { rows: ssoRows } = await db.query(
        `SELECT enabled, issuer_url, client_id
           FROM org_sso
          WHERE org_id = $1
          LIMIT 1`,
        [orgId]
      );
      const sso = ssoRows[0];
      if (!sso || !sso.enabled || !sso.issuer_url || !sso.client_id) {
        return res.status(400).json({
          success: false,
          error: 'SSO must be configured and enabled before requiring it.',
        });
      }
    }

    const { rows } = await db.query(
      `INSERT INTO org_policies (org_id, require_sso)
       VALUES ($1, $2)
       ON CONFLICT (org_id) DO UPDATE SET
         require_sso = EXCLUDED.require_sso,
         updated_at = NOW()
       RETURNING id, require_sso, created_at, updated_at`,
      [orgId, requireSso]
    );

    await logAudit({
      org_id: orgId,
      user_id: actorId,
      action: 'org.policy.update',
      entity_type: 'org_policy',
      entity_id: rows[0].id,
      metadata: { require_sso: requireSso },
    });

    return res.json({ success: true, data: rows[0] });
  } catch (e) {
    log('error', 'orgPolicy.update error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

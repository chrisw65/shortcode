import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';
import db from '../config/database';
import { log } from '../utils/logger';

export type OrgRole = 'owner' | 'admin' | 'member';

export type OrgRequest = AuthenticatedRequest & {
  org?: {
    orgId: string;
    role: OrgRole;
    is_active?: boolean;
  };
};

export async function requireOrg(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    if (req.apiKey?.orgId) {
      const { rows: orgRows } = await db.query<{ is_active: boolean }>(
        `SELECT COALESCE(is_active, true) AS is_active FROM orgs WHERE id = $1 LIMIT 1`,
        [req.apiKey.orgId],
      );
      if (!orgRows.length) {
        return res.status(403).json({ success: false, error: 'Organization not found' });
      }
      req.org = { orgId: req.apiKey.orgId, role: 'admin', is_active: orgRows[0].is_active };
      return next();
    }

    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const requestedOrgId = String(req.headers['x-org-id'] || req.query.org_id || '').trim();
    const params: Array<string> = [userId];
    let sql = `
      SELECT m.org_id, m.role, COALESCE(o.is_active, true) AS is_active
        FROM org_memberships m
        JOIN orgs o ON o.id = m.org_id
       WHERE m.user_id = $1
    `;
    if (requestedOrgId) {
      params.push(requestedOrgId);
      sql += ' AND org_id = $2';
    } else {
      sql += ' ORDER BY (role = \'owner\') DESC, created_at ASC';
    }
    sql += ' LIMIT 1';

    const { rows } = await db.query<{ org_id: string; role: 'owner' | 'admin' | 'member'; is_active: boolean }>(sql, params);

    if (!rows.length) {
      return res.status(403).json({ success: false, error: 'No organization membership' });
    }

    req.org = { orgId: rows[0].org_id, role: rows[0].role, is_active: rows[0].is_active };
    return next();
  } catch (e) {
    log('error', 'requireOrg error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

const roleRank: Record<OrgRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

export function requireOrgRole(roles: Array<OrgRole>) {
  const minRank = Math.min(...roles.map((r) => roleRank[r]));
  return (req: OrgRequest, res: Response, next: NextFunction) => {
    const role = req.org?.role;
    if (!role) return res.status(403).json({ success: false, error: 'No organization role' });
    if (roleRank[role] < minRank) {
      return res.status(403).json({ success: false, error: 'Insufficient role' });
    }
    return next();
  };
}

export function requireActiveOrg(req: OrgRequest, res: Response, next: NextFunction) {
  if (req.user?.is_superadmin) return next();
  if (req.org?.is_active === false) {
    return res.status(402).json({
      success: false,
      error: 'Organization suspended',
      suspended: true,
      payment_url: '/admin/billing.html',
    });
  }
  return next();
}

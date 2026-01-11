import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';
import db from '../config/database';
import { log } from '../utils/logger';

export type OrgRole = 'owner' | 'admin' | 'member';

export type OrgRequest = AuthenticatedRequest & {
  org?: {
    orgId: string;
    role: OrgRole;
  };
};

export async function requireOrg(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    if (req.apiKey?.orgId) {
      req.org = { orgId: req.apiKey.orgId, role: 'admin' };
      return next();
    }

    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const requestedOrgId = String(req.headers['x-org-id'] || req.query.org_id || '').trim();
    const params: Array<string> = [userId];
    let sql = `
      SELECT org_id, role
        FROM org_memberships
       WHERE user_id = $1
    `;
    if (requestedOrgId) {
      params.push(requestedOrgId);
      sql += ' AND org_id = $2';
    } else {
      sql += ' ORDER BY (role = \'owner\') DESC, created_at ASC';
    }
    sql += ' LIMIT 1';

    const { rows } = await db.query<{ org_id: string; role: 'owner' | 'admin' | 'member' }>(sql, params);

    if (!rows.length) {
      return res.status(403).json({ success: false, error: 'No organization membership' });
    }

    req.org = { orgId: rows[0].org_id, role: rows[0].role };
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

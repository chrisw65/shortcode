import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';
import db from '../config/database';

export type OrgRequest = AuthenticatedRequest & {
  org?: {
    orgId: string;
    role: 'owner' | 'admin' | 'member';
  };
};

export async function requireOrg(req: OrgRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { rows } = await db.query<{ org_id: string; role: 'owner' | 'admin' | 'member' }>(
      `SELECT org_id, role
         FROM org_memberships
        WHERE user_id = $1
        ORDER BY (role = 'owner') DESC, created_at ASC
        LIMIT 1`,
      [userId],
    );

    if (!rows.length) {
      return res.status(403).json({ success: false, error: 'No organization membership' });
    }

    req.org = { orgId: rows[0].org_id, role: rows[0].role };
    return next();
  } catch (e) {
    console.error('requireOrg error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

const roleRank: Record<OrgRequest['org']['role'], number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

export function requireOrgRole(roles: Array<OrgRequest['org']['role']>) {
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

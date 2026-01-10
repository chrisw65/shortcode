import type { Response } from 'express';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import type { OrgRequest } from '../middleware/org';
import db from '../config/database';
import { logAudit } from '../services/audit';
import { clearOrgLimitCache } from '../services/orgLimits';

function tempPassword() {
  return randomBytes(9).toString('hex');
}

export async function listMembers(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const { rows } = await db.query(
      `SELECT m.id, m.role, m.created_at,
              u.id AS user_id, u.email, u.name, u.is_active, u.email_verified
         FROM org_memberships m
         JOIN users u ON u.id = m.user_id
        WHERE m.org_id = $1
        ORDER BY m.created_at ASC`,
      [orgId]
    );
    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error('listMembers error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function addMember(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const actorId = req.user?.userId ?? null;
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const role = (String(req.body?.role ?? 'member').trim().toLowerCase() || 'member') as 'owner' | 'admin' | 'member';
    if (!email) return res.status(400).json({ success: false, error: 'email is required' });
    if (!['owner', 'admin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, error: 'invalid role' });
    }

    await db.query('BEGIN');

    const userRes = await db.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    let userId = userRes.rows[0]?.id as string | undefined;
    let tempPass: string | null = null;
    if (!userId) {
      tempPass = tempPassword();
      const hash = await bcrypt.hash(tempPass, 12);
      const ins = await db.query(
        `INSERT INTO users (email, password, name, plan, is_active, email_verified, is_superadmin)
         VALUES ($1, $2, NULL, 'free', true, false, false)
         RETURNING id`,
        [email, hash]
      );
      userId = ins.rows[0].id;
    }

    const { rows } = await db.query(
      `INSERT INTO org_memberships (org_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING id, role, user_id`,
      [orgId, userId, role]
    );

    await logAudit({
      org_id: orgId,
      user_id: actorId,
      action: 'org.member.add',
      entity_type: 'org_member',
      entity_id: rows[0].id,
      metadata: { email, role },
    });

    await db.query('COMMIT');

    return res.status(201).json({
      success: true,
      data: { member_id: rows[0].id, user_id: rows[0].user_id, role: rows[0].role, temp_password: tempPass },
    });
  } catch (e) {
    try { await db.query('ROLLBACK'); } catch {}
    console.error('addMember error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function removeMember(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const actorId = req.user?.userId ?? null;
    const { memberId } = req.params;

    const { rows } = await db.query(
      `DELETE FROM org_memberships
        WHERE id = $1 AND org_id = $2
      RETURNING id, user_id, role`,
      [memberId, orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Member not found' });

    await logAudit({
      org_id: orgId,
      user_id: actorId,
      action: 'org.member.remove',
      entity_type: 'org_member',
      entity_id: rows[0].id,
      metadata: { user_id: rows[0].user_id, role: rows[0].role },
    });

    return res.json({ success: true, data: { removed: true } });
  } catch (e) {
    console.error('removeMember error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function getOrg(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const { rows } = await db.query(
      `SELECT id, name, owner_user_id, ip_anonymization, data_retention_days,
              api_rate_limit_rpm, link_limit, domain_limit, created_at
         FROM orgs
        WHERE id = $1
        LIMIT 1`,
      [orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Org not found' });
    return res.json({ success: true, data: rows[0] });
  } catch (e) {
    console.error('getOrg error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateOrg(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const actorId = req.user?.userId ?? null;
    const name = String(req.body?.name ?? '').trim();
    const ipAnonymization = req.body?.ip_anonymization;
    const retentionRaw = req.body?.data_retention_days;
    const apiRateRaw = req.body?.api_rate_limit_rpm;
    const linkLimitRaw = req.body?.link_limit;
    const domainLimitRaw = req.body?.domain_limit;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    const anonValue = typeof ipAnonymization === 'boolean' ? ipAnonymization : null;
    let retentionProvided = false;
    let retentionValue: number | null = null;
    if (typeof retentionRaw !== 'undefined') {
      retentionProvided = true;
      if (retentionRaw === null) {
        retentionValue = null;
      } else {
        const parsed = Number(retentionRaw);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
          return res.status(400).json({ success: false, error: 'data_retention_days must be 1-3650' });
        }
        retentionValue = parsed;
      }
    }

    let apiRateProvided = false;
    let apiRateValue: number | null = null;
    if (typeof apiRateRaw !== 'undefined') {
      apiRateProvided = true;
      if (apiRateRaw === null || apiRateRaw === '') {
        apiRateValue = null;
      } else {
        const parsed = Number(apiRateRaw);
        if (!Number.isInteger(parsed) || parsed < 30 || parsed > 100000) {
          return res.status(400).json({ success: false, error: 'api_rate_limit_rpm must be 30-100000' });
        }
        apiRateValue = parsed;
      }
    }

    let linkLimitProvided = false;
    let linkLimitValue: number | null = null;
    if (typeof linkLimitRaw !== 'undefined') {
      linkLimitProvided = true;
      if (linkLimitRaw === null || linkLimitRaw === '') {
        linkLimitValue = null;
      } else {
        const parsed = Number(linkLimitRaw);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000000) {
          return res.status(400).json({ success: false, error: 'link_limit must be 1-1000000' });
        }
        linkLimitValue = parsed;
      }
    }

    let domainLimitProvided = false;
    let domainLimitValue: number | null = null;
    if (typeof domainLimitRaw !== 'undefined') {
      domainLimitProvided = true;
      if (domainLimitRaw === null || domainLimitRaw === '') {
        domainLimitValue = null;
      } else {
        const parsed = Number(domainLimitRaw);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100000) {
          return res.status(400).json({ success: false, error: 'domain_limit must be 1-100000' });
        }
        domainLimitValue = parsed;
      }
    }

    const { rows } = await db.query(
      `UPDATE orgs
          SET name = $1,
              ip_anonymization = COALESCE($2, ip_anonymization),
              data_retention_days = CASE WHEN $3 THEN $4 ELSE data_retention_days END,
              api_rate_limit_rpm = CASE WHEN $5 THEN $6 ELSE api_rate_limit_rpm END,
              link_limit = CASE WHEN $7 THEN $8 ELSE link_limit END,
              domain_limit = CASE WHEN $9 THEN $10 ELSE domain_limit END
        WHERE id = $11
        RETURNING id, name, owner_user_id, ip_anonymization, data_retention_days,
                  api_rate_limit_rpm, link_limit, domain_limit, created_at`,
      [name, anonValue, retentionProvided, retentionValue, apiRateProvided, apiRateValue, linkLimitProvided, linkLimitValue, domainLimitProvided, domainLimitValue, orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Org not found' });

    await logAudit({
      org_id: orgId,
      user_id: actorId,
      action: 'org.update',
      entity_type: 'org',
      entity_id: orgId,
      metadata: {
        name,
        ip_anonymization: anonValue,
        data_retention_days: retentionProvided ? retentionValue : undefined,
        api_rate_limit_rpm: apiRateProvided ? apiRateValue : undefined,
        link_limit: linkLimitProvided ? linkLimitValue : undefined,
        domain_limit: domainLimitProvided ? domainLimitValue : undefined,
      },
    });

    clearOrgLimitCache(orgId);
    return res.json({ success: true, data: rows[0] });
  } catch (e) {
    console.error('updateOrg error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function listUserOrgs(req: OrgRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { rows } = await db.query(
      `SELECT o.id, o.name, o.owner_user_id, o.created_at, m.role
         FROM org_memberships m
         JOIN orgs o ON o.id = m.org_id
        WHERE m.user_id = $1
        ORDER BY o.created_at ASC`,
      [userId]
    );
    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error('listUserOrgs error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

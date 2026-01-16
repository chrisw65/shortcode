import type { Request, Response } from 'express';
import db from '../config/database';
import { log } from '../utils/logger';
import { sendMail, hasSmtpConfig } from '../services/mailer';

function mapBillingStatus(status: string | null, periodEnd: Date | null) {
  const normalized = String(status || '').toLowerCase();
  const activeStatuses = new Set(['active', 'trialing']);
  const now = Date.now();
  const endOk = !periodEnd || periodEnd.getTime() > now;
  return {
    status: normalized || 'none',
    is_paid: activeStatuses.has(normalized) && endOk,
  };
}

export async function listOrgsAdmin(req: Request, res: Response) {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const params: any[] = [];
    let where = '';
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE (o.name ILIKE $1 OR u.email ILIKE $1)`;
    }
    const limitIdx = params.push(limit);
    const offsetIdx = params.push(offset);

    const { rows } = await db.query(
      `
      SELECT o.id, o.name, o.created_at, COALESCE(o.is_active, true) AS is_active,
             o.suspended_at, o.suspended_reason,
             u.id AS owner_id, u.email AS owner_email, u.name AS owner_name, COALESCE(u.plan, 'free') AS owner_plan,
             (SELECT COUNT(*)::int FROM org_memberships m WHERE m.org_id = o.id) AS users_count,
             (SELECT COUNT(*)::int FROM links l WHERE l.org_id = o.id) AS links_count,
             (SELECT COUNT(*)::int FROM domains d WHERE d.org_id = o.id) AS domains_count,
             (SELECT MAX(c.occurred_at) FROM click_events c JOIN links l ON l.id = c.link_id WHERE l.org_id = o.id) AS last_click_at,
             (SELECT c.country_name FROM click_events c JOIN links l ON l.id = c.link_id WHERE l.org_id = o.id AND c.country_name IS NOT NULL ORDER BY c.occurred_at DESC LIMIT 1) AS last_country,
             (SELECT plan FROM plan_grants WHERE target_type = 'org' AND target_id = o.id AND (ends_at IS NULL OR ends_at > NOW()) ORDER BY ends_at DESC NULLS LAST, created_at DESC LIMIT 1) AS plan_override,
             (SELECT status FROM billing_subscriptions bs WHERE bs.org_id = o.id ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1) AS billing_status,
             (SELECT current_period_end FROM billing_subscriptions bs WHERE bs.org_id = o.id ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1) AS billing_period_end,
             (SELECT cancel_at_period_end FROM billing_subscriptions bs WHERE bs.org_id = o.id ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1) AS billing_cancel_at_period_end
        FROM orgs o
        LEFT JOIN users u ON u.id = o.owner_user_id
        ${where}
       ORDER BY o.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      params,
    );

    const data = rows.map((row: any) => {
      const billing = mapBillingStatus(row.billing_status, row.billing_period_end ? new Date(row.billing_period_end) : null);
      return {
        id: row.id,
        name: row.name,
        created_at: row.created_at,
        is_active: row.is_active,
        suspended_at: row.suspended_at,
        suspended_reason: row.suspended_reason,
        owner: {
          id: row.owner_id,
          email: row.owner_email,
          name: row.owner_name,
        },
        plan: row.plan_override || row.owner_plan || 'free',
        users_count: row.users_count ?? 0,
        links_count: row.links_count ?? 0,
        domains_count: row.domains_count ?? 0,
        last_click_at: row.last_click_at,
        last_country: row.last_country,
        billing_status: billing.status,
        billing_paid: billing.is_paid,
        billing_period_end: row.billing_period_end,
        billing_cancel_at_period_end: row.billing_cancel_at_period_end === true,
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    log('error', 'admin.listOrgs error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function getOrgAdmin(req: Request, res: Response) {
  try {
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ success: false, error: 'org id is required' });
    const { rows } = await db.query(
      `SELECT o.id, o.name, o.created_at, COALESCE(o.is_active, true) AS is_active,
              o.suspended_at, o.suspended_reason,
              u.id AS owner_id, u.email AS owner_email, u.name AS owner_name, COALESCE(u.plan, 'free') AS owner_plan
         FROM orgs o
         LEFT JOIN users u ON u.id = o.owner_user_id
        WHERE o.id = $1
        LIMIT 1`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Org not found' });
    const org = rows[0];
    const members = await db.query(
      `SELECT m.id, m.role, m.created_at,
              u.id AS user_id, u.email, u.name, COALESCE(u.is_active, true) AS is_active, COALESCE(u.email_verified, true) AS email_verified
         FROM org_memberships m
         JOIN users u ON u.id = m.user_id
        WHERE m.org_id = $1
        ORDER BY (m.role = 'owner') DESC, m.created_at ASC`,
      [id],
    );
    return res.json({
      success: true,
      data: {
        id: org.id,
        name: org.name,
        created_at: org.created_at,
        is_active: org.is_active,
        suspended_at: org.suspended_at,
        suspended_reason: org.suspended_reason,
        owner: {
          id: org.owner_id,
          email: org.owner_email,
          name: org.owner_name,
        },
        members: members.rows,
      },
    });
  } catch (err) {
    log('error', 'admin.getOrg error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateOrgStatusAdmin(req: Request, res: Response) {
  try {
    const orgId = String(req.params.id || '');
    const isActive = req.body?.is_active;
    const reason = String(req.body?.reason || '').trim();
    if (!orgId || typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'org id and is_active are required' });
    }
    const { rows } = await db.query(
      `UPDATE orgs
          SET is_active = $1,
              suspended_at = CASE WHEN $1 = false THEN NOW() ELSE NULL END,
              suspended_reason = CASE WHEN $1 = false THEN $2 ELSE NULL END
        WHERE id = $3
        RETURNING id, name, is_active, suspended_at, suspended_reason`,
      [isActive, reason || null, orgId],
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Org not found' });

    if (isActive === false) {
      const ownerRes = await db.query<{ email: string }>(
        `SELECT u.email
           FROM orgs o
           JOIN users u ON u.id = o.owner_user_id
          WHERE o.id = $1
          LIMIT 1`,
        [orgId],
      );
      const ownerEmail = ownerRes.rows[0]?.email;
      if (ownerEmail && (await hasSmtpConfig())) {
        const subject = 'Your OkLeaf account is suspended';
        const text = [
          'Your OkLeaf organization has been suspended.',
          reason ? `Reason: ${reason}` : '',
          'You can restore access by updating billing at https://okleaf.link/admin/billing.html',
        ].filter(Boolean).join('\n');
        try {
          await sendMail({ to: ownerEmail, subject, text });
        } catch (err) {
          log('warn', 'admin.suspend email failed', { error: String(err) });
        }
      }
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    log('error', 'admin.updateOrgStatus error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateOrgPlanAdmin(req: Request, res: Response) {
  try {
    const orgId = String(req.params.id || '');
    const plan = String(req.body?.plan || '').trim();
    const durationMonths = Number(req.body?.duration_months || 0);
    const reason = String(req.body?.reason || 'admin_override');
    if (!orgId || !plan) {
      return res.status(400).json({ success: false, error: 'org id and plan are required' });
    }
    await db.query(
      `UPDATE plan_grants
          SET ends_at = NOW()
        WHERE target_type = 'org'
          AND target_id = $1
          AND reason = 'admin_override'
          AND (ends_at IS NULL OR ends_at > NOW())`,
      [orgId],
    );
    const { rows } = await db.query(
      `INSERT INTO plan_grants (target_type, target_id, plan, ends_at, reason, created_by)
       VALUES ('org', $1, $2,
               CASE WHEN $3 > 0 THEN NOW() + ($3 || ' months')::interval ELSE NULL END,
               $4, NULL)
       RETURNING id, target_type, target_id, plan, starts_at, ends_at, reason, created_at`,
      [orgId, plan, durationMonths, reason],
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    log('error', 'admin.updateOrgPlan error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateUserStatusAdmin(req: Request, res: Response) {
  try {
    const userId = String(req.params.id || '');
    const isActive = req.body?.is_active;
    if (!userId || typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'user id and is_active are required' });
    }
    const { rows } = await db.query(
      `UPDATE users
          SET is_active = $1
        WHERE id = $2
        RETURNING id, email, is_active`,
      [isActive, userId],
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    log('error', 'admin.updateUserStatus error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

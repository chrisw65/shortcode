import type { Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import db from '../config/database';
import type { AuthenticatedRequest } from '../middleware/auth';
import { recordConsent } from '../services/consent';
import { logAudit } from '../services/audit';

export async function exportUserData(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const userRes = await db.query(
      `SELECT id, email, name, plan, is_active, email_verified, is_superadmin, created_at, deleted_at
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [userId]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const consents = await db.query(
      `SELECT consent_type, version, accepted_at, metadata
         FROM user_consents
        WHERE user_id = $1
        ORDER BY accepted_at DESC`,
      [userId]
    );

    const orgs = await db.query(
      `SELECT m.org_id, m.role, o.name, o.owner_user_id, o.created_at
         FROM org_memberships m
         JOIN orgs o ON o.id = m.org_id
        WHERE m.user_id = $1
        ORDER BY o.created_at ASC`,
      [userId]
    );

    const links = await db.query(
      `SELECT id, short_code, original_url, title, click_count, created_at, expires_at, active
         FROM links
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );

    const domains = await db.query(
      `SELECT id, domain, verified, is_default, is_active, created_at
         FROM domains
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );

    const apiKeys = await db.query(
      `SELECT id, name, prefix, created_at, revoked_at, last_used_at
         FROM api_keys
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );

    const payload = {
      user,
      consents: consents.rows,
      org_memberships: orgs.rows,
      links: links.rows,
      domains: domains.rows,
      api_keys: apiKeys.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=\"user-export.json\"');
    return res.send(JSON.stringify(payload, null, 2));
  } catch (e) {
    console.error('privacy.export error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const ownedOrgs = await db.query(
      `SELECT org_id
         FROM org_memberships
        WHERE user_id = $1 AND role = 'owner'`,
      [userId]
    );
    if (ownedOrgs.rows.length) {
      const ownerCounts = await db.query(
        `SELECT org_id, COUNT(*) FILTER (WHERE role = 'owner') AS owners
           FROM org_memberships
          WHERE org_id = ANY($1)
          GROUP BY org_id`,
        [ownedOrgs.rows.map((r) => r.org_id)]
      );
      const blocked = ownerCounts.rows.find((r) => Number(r.owners) <= 1);
      if (blocked) {
        return res.status(400).json({ success: false, error: 'Transfer org ownership before deletion' });
      }
    }

    const memberships = await db.query(
      `SELECT org_id FROM org_memberships WHERE user_id = $1`,
      [userId]
    );

    const anonymizedEmail = `deleted+${randomUUID()}@okleaf.link`;
    const hash = await bcrypt.hash(randomUUID(), 12);

    await db.query('BEGIN');

    await db.query(
      `UPDATE users
          SET email = $1,
              password = $2,
              name = NULL,
              is_active = false,
              email_verified = false,
              deleted_at = NOW()
        WHERE id = $3`,
      [anonymizedEmail, hash, userId]
    );
    await db.query(`DELETE FROM api_keys WHERE user_id = $1`, [userId]);
    await db.query(`DELETE FROM user_consents WHERE user_id = $1`, [userId]);
    await db.query(`DELETE FROM org_memberships WHERE user_id = $1`, [userId]);

    await db.query('COMMIT');

    for (const row of memberships.rows) {
      await logAudit({
        org_id: row.org_id,
        user_id: userId,
        action: 'user.deleted',
        entity_type: 'user',
        entity_id: userId,
        metadata: { email: anonymizedEmail },
      });
    }

    return res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    try { await db.query('ROLLBACK'); } catch (rbErr) { console.warn('rollback failed:', rbErr); }
    console.error('privacy.delete error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function acceptTerms(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const version = String(req.body?.version || process.env.TERMS_VERSION || '2026-01');
    await recordConsent({ user_id: userId, consent_type: 'terms', version, metadata: { source: 'settings' } });
    return res.json({ success: true, data: { accepted: true, version } });
  } catch (e) {
    console.error('privacy.terms error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

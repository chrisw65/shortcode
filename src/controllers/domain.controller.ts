// src/controllers/domain.controller.ts
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { promises as dns } from 'node:dns';
import db from '../config/database';
import { logAudit } from '../services/audit';
import { tryGrantReferralReward } from '../services/referrals';
import { getEffectivePlan, isPaidPlan } from '../services/plan';
import { getOrgLimits } from '../services/orgLimits';
import { autoProvisionDns } from '../services/dnsAutomation';
import { log } from '../utils/logger';

// Local auth-aware request type (your middleware attaches req.user/org)
type JwtUser = { userId: string; email?: string };
type AuthedRequest = Request & { user: JwtUser; org: { orgId: string } };

/**
 * domains schema assumed:
 *  id UUID PK DEFAULT uuid_generate_v4()
 *  user_id UUID REFERENCES users(id) ON DELETE CASCADE
 *  domain VARCHAR(255) NOT NULL
 *  is_default BOOLEAN DEFAULT false
 *  is_active BOOLEAN DEFAULT true
 *  verified BOOLEAN DEFAULT false
 *  verification_token VARCHAR(128) NULL
 *  verified_at TIMESTAMP NULL
 *  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 *
 * Unique index on (user_id, domain).
 */

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function newVerificationToken(): string {
  // 32 bytes -> 64 hex chars
  return randomBytes(32).toString('hex');
}

async function ensureDomainQuota(orgId: string) {
  const limits = await getOrgLimits(orgId);
  if (!limits.domainLimit) return null;
  const { rows } = await db.query(`SELECT COUNT(*)::int AS count FROM domains WHERE org_id = $1`, [orgId]);
  const used = rows[0]?.count ?? 0;
  if (used + 1 > limits.domainLimit) {
    return { allowed: false, remaining: Math.max(0, limits.domainLimit - used), limit: limits.domainLimit };
  }
  return null;
}

function shape(row: any) {
  return {
    id: row.id,
    user_id: row.user_id,
    domain: row.domain,
    is_default: !!row.is_default,
    is_active: !!row.is_active,
    verified: !!row.verified,
    verification_token: row.verification_token ?? null,
    verified_at: row.verified_at,
    created_at: row.created_at,
  };
}

/**
 * GET /api/domains
 */
export async function listDomains(req: AuthedRequest, res: Response) {
  try {
    const orgId = req.org.orgId;
    const { rows } = await db.query(
      `SELECT id, user_id, domain, is_default, is_active, verified, verification_token, verified_at, created_at
         FROM domains
        WHERE org_id = $1
        ORDER BY is_default DESC, created_at DESC`,
      [orgId],
    );
    return res.json({ success: true, data: rows.map(shape) });
  } catch (e) {
    log('error', 'listDomains error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * POST /api/domains
 * Body: { domain: string, make_default?: boolean }
 */
export async function createDomain(req: AuthedRequest, res: Response) {
  try {
    const userId = req.user.userId;
    const orgId = req.org.orgId;
    const { domain, make_default } = req.body ?? {};

    const plan = await getEffectivePlan(userId, orgId);
    if (!isPaidPlan(plan)) {
      return res.status(403).json({ success: false, error: 'Custom domains require a paid plan' });
    }

    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ success: false, error: 'domain is required' });
    }

    const quota = await ensureDomainQuota(orgId);
    if (quota && !quota.allowed) {
      return res.status(403).json({ success: false, error: `Domain limit reached (${quota.limit}).` });
    }

    const d = normalizeDomain(domain);

    // Does it already exist for this user?
    const existing = await db.query(
      `SELECT id, verification_token FROM domains WHERE org_id = $1 AND domain = $2`,
      [orgId, d],
    );

    let row;
    if (existing.rows.length) {
      const id = existing.rows[0].id;
      const token = existing.rows[0].verification_token || newVerificationToken();

      const upd = await db.query(
        `UPDATE domains
            SET is_active = true,
                verification_token = $1
          WHERE id = $2
          RETURNING id, user_id, domain, is_default, is_active, verified, verification_token, verified_at, created_at`,
        [token, id],
      );
      row = upd.rows[0];

      if (make_default) {
        await db.query(`UPDATE domains SET is_default = false WHERE org_id = $1`, [orgId]);
        const def = await db.query(
          `UPDATE domains SET is_default = true WHERE id = $1 AND org_id = $2
           RETURNING id, user_id, domain, is_default, is_active, verified, verification_token, verified_at, created_at`,
          [id, orgId],
        );
        row = def.rows[0];
      }
    } else {
      const token = newVerificationToken();
      const ins = await db.query(
        `INSERT INTO domains (org_id, user_id, domain, is_default, is_active, verified, verification_token)
         VALUES ($1, $2, $3, $4, true, false, $5)
         RETURNING id, user_id, domain, is_default, is_active, verified, verification_token, verified_at, created_at`,
        [orgId, userId, d, !!make_default, token],
      );
      row = ins.rows[0];

      if (make_default && !row.is_default) {
        await db.query(`UPDATE domains SET is_default = false WHERE org_id = $1`, [orgId]);
        const def = await db.query(
          `UPDATE domains SET is_default = true WHERE id = $1 AND org_id = $2
           RETURNING id, user_id, domain, is_default, is_active, verified, verification_token, verified_at, created_at`,
          [row.id, orgId],
        );
        row = def.rows[0];
      }
    }

    await logAudit({
      org_id: orgId,
      user_id: req.user.userId,
      action: 'domain.create',
      entity_type: 'domain',
      entity_id: row.id,
      metadata: { domain: row.domain },
    });

    const automation = await autoProvisionDns(row.domain, row.verification_token);
    try { await tryGrantReferralReward(userId, orgId); } catch (err) { log('error', 'referral reward error', { error: String(err) }); }
    return res.status(201).json({
      success: true,
      data: shape(row),
      automation,
      instructions: {
        txt_records: [
          { host: `_shortlink.${row.domain}`, value: row.verification_token },
          { host: `${row.domain}`, value: `shortlink-verify=${row.verification_token}` },
        ],
        note: 'After adding the TXT record, call POST /api/domains/:id/verify.',
      },
    });
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e
      ? String((e as { code?: string }).code)
      : '';
    if (code === '23505') {
      return res.status(409).json({ success: false, error: 'Domain already exists' });
    }
    log('error', 'createDomain error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * POST /api/domains/:id/verify
 * Body: { token?: string }
 */
export async function verifyDomain(req: AuthedRequest, res: Response) {
  try {
    const orgId = req.org.orgId;
    const { id } = req.params;
    const { token: manualToken } = req.body ?? {};

    const { rows } = await db.query(
      `SELECT id, user_id, domain, verified, verification_token
         FROM domains
        WHERE id = $1 AND org_id = $2`,
      [id, orgId],
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Domain not found' });
    }

    const row = rows[0];
    if (!row.verification_token) {
      const tok = newVerificationToken();
      const up = await db.query(
        `UPDATE domains SET verification_token = $1 WHERE id = $2 RETURNING verification_token`,
        [tok, row.id],
      );
      row.verification_token = up.rows[0].verification_token;
    }

    const token: string = row.verification_token;

    // Manual token path
    if (typeof manualToken === 'string' && manualToken === token) {
      const upd = await db.query(
        `UPDATE domains
            SET verified = true, verified_at = NOW()
          WHERE id = $1 AND org_id = $2
          RETURNING id, user_id, domain, is_default, is_active, verified, verification_token, verified_at, created_at`,
        [row.id, orgId],
      );
      await logAudit({
        org_id: orgId,
        user_id: req.user.userId,
        action: 'domain.verify',
        entity_type: 'domain',
        entity_id: upd.rows[0].id,
        metadata: { method: 'manual' },
      });
      return res.json({ success: true, data: shape(upd.rows[0]), method: 'manual' });
    }

    // DNS TXT verification
    const host1 = `_shortlink.${row.domain}`;
    let txts: string[] = [];
    let method: 'dns' | 'dns-root' | null = null;

    try {
      const rr = await dns.resolveTxt(host1);
      const flat = rr.flat().map((s) => s.trim());
      if (flat.includes(token)) {
        txts = flat;
        method = 'dns';
      }
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e
        ? String((e as { code?: string }).code)
        : '';
      if (!['ENOTFOUND', 'ENODATA', 'ETIMEOUT', 'EAI_AGAIN', 'SERVFAIL'].includes(code)) {
        log('warn', `TXT lookup error for ${host1}`, { error: String(e) });
      }
    }

    if (!method) {
      try {
        const rr2 = await dns.resolveTxt(row.domain);
        const flat2 = rr2.flat().map((s) => s.trim());
        const match = flat2.find((v) => v === `shortlink-verify=${token}`);
        if (match) {
          txts = flat2;
          method = 'dns-root';
        }
      } catch (e) {
        const code = e && typeof e === 'object' && 'code' in e
          ? String((e as { code?: string }).code)
          : '';
        if (!['ENOTFOUND', 'ENODATA', 'ETIMEOUT', 'EAI_AGAIN', 'SERVFAIL'].includes(code)) {
          log('warn', `TXT lookup error for ${row.domain}`, { error: String(e) });
        }
      }
    }

    if (!method) {
      return res.status(400).json({
        success: false,
        error: 'TXT record not found or token mismatch',
        expected: {
          either: [
            { host: host1, value: token },
            { host: row.domain, value: `shortlink-verify=${token}` },
          ],
        },
      });
    }

    const upd = await db.query(
      `UPDATE domains
          SET verified = true, verified_at = NOW()
        WHERE id = $1 AND org_id = $2
        RETURNING id, user_id, domain, is_default, is_active, verified, verification_token, verified_at, created_at`,
      [row.id, orgId],
    );

    await logAudit({
      org_id: orgId,
      user_id: req.user.userId,
      action: 'domain.verify',
      entity_type: 'domain',
      entity_id: upd.rows[0].id,
      metadata: { method },
    });
    return res.json({ success: true, data: shape(upd.rows[0]), method, txts_sample: txts.slice(0, 5) });
  } catch (e) {
    log('error', 'verifyDomain error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * POST /api/domains/:id/default
 */
export async function setDefaultDomain(req: AuthedRequest, res: Response) {
  try {
    const orgId = req.org.orgId;
    const { id } = req.params;

    const { rows } = await db.query(
      `SELECT id, user_id, domain, is_active, verified
         FROM domains
        WHERE id = $1 AND org_id = $2`,
      [id, orgId],
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Domain not found' });
    }

    const d = rows[0];
    if (!d.is_active) {
      return res.status(400).json({ success: false, error: 'Domain is not active' });
    }
    if (!d.verified) {
      return res.status(400).json({ success: false, error: 'Domain must be verified before setting default' });
    }

    await db.query(`UPDATE domains SET is_default = false WHERE org_id = $1`, [orgId]);
    const upd = await db.query(
      `UPDATE domains
          SET is_default = true
        WHERE id = $1 AND org_id = $2
        RETURNING id, user_id, domain, is_default, is_active, verified, verification_token, verified_at, created_at`,
      [id, orgId],
    );

    await logAudit({
      org_id: orgId,
      user_id: req.user.userId,
      action: 'domain.set_default',
      entity_type: 'domain',
      entity_id: upd.rows[0].id,
    });
    return res.json({ success: true, data: shape(upd.rows[0]) });
  } catch (e) {
    log('error', 'setDefaultDomain error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * DELETE /api/domains/:id
 */
export async function deleteDomain(req: AuthedRequest, res: Response) {
  try {
    const orgId = req.org.orgId;
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM domains WHERE id = $1 AND org_id = $2`,
      [id, orgId],
    );

    const deleted = (result.rowCount ?? 0) > 0;
    await logAudit({
      org_id: orgId,
      user_id: req.user.userId,
      action: 'domain.delete',
      entity_type: 'domain',
      entity_id: id,
      metadata: { deleted },
    });
    return res.json({ success: true, data: { deleted } });
  } catch (e) {
    log('error', 'deleteDomain error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

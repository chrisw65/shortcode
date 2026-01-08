// src/controllers/link.controller.ts
import { Request, Response } from 'express';
import { nanoid } from 'nanoid';
import db from '../config/database';
import { logAudit } from '../services/audit';
import { tryGrantReferralReward } from '../services/referrals';

type UserReq = Request & { user: { userId: string }; org: { orgId: string } };

function ensureHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function parseHostnameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

const RESERVED = new Set([
  'admin','api','login','logout','register','health','ready','favicon.ico',
  'robots.txt','sitemap.xml','manifest.json','service-worker.js'
]);

function validateCustomCode(code: string): { ok: boolean; error?: string } {
  if (!code) return { ok: false, error: 'short_code cannot be empty' };
  if (code.length < 3 || code.length > 32) {
    return { ok: false, error: 'short_code must be 3–32 characters' };
  }
  if (!/^[A-Za-z0-9\-_]+$/.test(code)) {
    return { ok: false, error: 'short_code may include letters, digits, - and _ only' };
  }
  if (RESERVED.has(code.toLowerCase())) {
    return { ok: false, error: 'short_code is reserved' };
  }
  return { ok: true };
}

async function resolveUserBaseUrl(userId: string): Promise<{ baseUrl: string; domainId: string | null }> {
  // If you later wire default_domain_id, this SELECT can switch to that.
  // For now we render using PUBLIC_HOST (or BASE_URL) when no verified user default.
  const envHost = process.env.PUBLIC_HOST || process.env.BASE_URL || 'http://localhost:3000';
  return { baseUrl: envHost, domainId: null };
}

function shapeLink(row: any, baseUrl: string) {
  return {
    id: row.id,
    user_id: row.user_id,
    short_code: row.short_code,
    original_url: row.original_url,
    title: row.title,
    click_count: Number(row.click_count || 0),
    created_at: row.created_at,
    expires_at: row.expires_at,
    active: row.active !== false, // default true
    short_url: `${baseUrl}/${row.short_code}`,
  };
}

/**
 * POST /api/links
 * Body: { url: string, title?: string, short_code?: string, expires_at?: string }
 * Accepts optional custom short_code with validation.
 */
export async function createLink(req: UserReq, res: Response) {
  try {
    const userId = req.user.userId;
    const orgId = req.org.orgId;
    const { url, title, short_code, expires_at } = req.body ?? {};
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

    const normalizedUrl = ensureHttpUrl(String(url).trim());
    if (!normalizedUrl) {
      return res.status(400).json({ success: false, error: 'URL must be http(s)' });
    }

    const autoTitle = parseHostnameFromUrl(normalizedUrl) || 'link';

    let code = short_code ? String(short_code).trim() : nanoid(8);
    if (short_code) {
      const v = validateCustomCode(code);
      if (!v.ok) return res.status(400).json({ success: false, error: v.error });
    }
    code = code.replace(/\s+/g, '');

    const { baseUrl, domainId } = await resolveUserBaseUrl(userId);

    const q = `
      INSERT INTO links (org_id, user_id, short_code, original_url, title, domain_id, expires_at, active)
      VALUES ($1, $2, $3, $4, COALESCE($5, $6), $7, $8, true)
      RETURNING id, user_id, short_code, original_url, title, click_count, created_at, expires_at, active
    `;
    const { rows } = await db.query(q, [orgId, userId, code, normalizedUrl, title ?? null, autoTitle, domainId, expires_at ?? null]);

    await logAudit({
      org_id: orgId,
      user_id: userId,
      action: 'link.create',
      entity_type: 'link',
      entity_id: rows[0].id,
      metadata: { short_code: rows[0].short_code },
    });

    try { await tryGrantReferralReward(userId, orgId); } catch (err) { console.error('referral reward error:', err); }
    return res.status(201).json({ success: true, data: shapeLink(rows[0], baseUrl) });
  } catch (e: any) {
    if (e?.code === '23505') {
      return res.status(409).json({ success: false, error: 'short_code already exists' });
    }
    console.error('createLink error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/links
 */
export async function getUserLinks(req: UserReq, res: Response) {
  try {
    const orgId = req.org.orgId;
    const { baseUrl } = await resolveUserBaseUrl(req.user.userId);
    const { rows } = await db.query(
      `SELECT id, user_id, short_code, original_url, title, click_count, created_at, expires_at, active
         FROM links
        WHERE org_id = $1
        ORDER BY created_at DESC`,
      [orgId]
    );
    return res.json({ success: true, data: rows.map(r => shapeLink(r, baseUrl)) });
  } catch (e) {
    console.error('getUserLinks error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/links/:shortCode
 */
export async function getLinkDetails(req: UserReq, res: Response) {
  try {
    const orgId = req.org.orgId;
    const { shortCode } = req.params;
    const { rows } = await db.query(
      `SELECT id, user_id, short_code, original_url, title, click_count, created_at, expires_at, active
         FROM links
        WHERE org_id = $1 AND short_code = $2`,
      [orgId, shortCode]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Link not found' });

    const { baseUrl } = await resolveUserBaseUrl(req.user.userId);
    return res.json({ success: true, data: shapeLink(rows[0], baseUrl) });
  } catch (e) {
    console.error('getLinkDetails error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * PUT /api/links/:shortCode
 * Body may include: { url?: string, title?: string, expires_at?: string | null, short_code?: string }
 * You may also update custom code (validates and preserves uniqueness).
 */
export async function updateLink(req: UserReq, res: Response) {
  try {
    const orgId = req.org.orgId;
    const { shortCode } = req.params;
    const { url, title, expires_at, short_code } = req.body ?? {};

    const { rows: existing } = await db.query(
      `SELECT id FROM links WHERE org_id = $1 AND short_code = $2`,
      [orgId, shortCode]
    );
    if (!existing.length) return res.status(404).json({ success: false, error: 'Link not found' });

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;

    if (url !== undefined) {
      const normalizedUrl = ensureHttpUrl(String(url).trim());
      if (!normalizedUrl) {
        return res.status(400).json({ success: false, error: 'URL must be http(s)' });
      }
      sets.push(`original_url = $${i++}`);
      vals.push(normalizedUrl);
    }
    if (title !== undefined) { sets.push(`title = $${i++}`); vals.push(title); }
    if (expires_at !== undefined) { sets.push(`expires_at = $${i++}`); vals.push(expires_at); }
    if (short_code !== undefined) {
      const newCode = String(short_code).trim();
      const v = validateCustomCode(newCode);
      if (!v.ok) return res.status(400).json({ success: false, error: v.error });
      sets.push(`short_code = $${i++}`); vals.push(newCode);
    }

    if (!sets.length) {
      return res.json({ success: true, data: { updated: false } });
    }

    vals.push(orgId, shortCode);
    const q = `
      UPDATE links
         SET ${sets.join(', ')}
       WHERE org_id = $${i++} AND short_code = $${i++}
      RETURNING id, user_id, short_code, original_url, title, click_count, created_at, expires_at, active
    `;
    const { rows } = await db.query(q, vals);

    await logAudit({
      org_id: orgId,
      user_id: req.user.userId,
      action: 'link.update',
      entity_type: 'link',
      entity_id: rows[0].id,
      metadata: { short_code: rows[0].short_code },
    });

    const { baseUrl } = await resolveUserBaseUrl(req.user.userId);
    return res.json({ success: true, data: shapeLink(rows[0], baseUrl) });
  } catch (e: any) {
    if (e?.code === '23505') {
      return res.status(409).json({ success: false, error: 'short_code already exists' });
    }
    console.error('updateLink error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * PUT /api/links/:shortCode/status
 * Body: { active: boolean }
 */
export async function updateLinkStatus(req: UserReq, res: Response) {
  try {
    const orgId = req.org.orgId;
    const { shortCode } = req.params;
    const { active } = req.body ?? {};

    if (typeof active !== 'boolean') {
      return res.status(400).json({ success: false, error: 'active must be boolean' });
    }

    const { rows } = await db.query(
      `UPDATE links
          SET active = $1
        WHERE org_id = $2 AND short_code = $3
      RETURNING id, user_id, short_code, original_url, title, click_count, created_at, expires_at, active`,
      [active, orgId, shortCode]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Link not found' });

    await logAudit({
      org_id: orgId,
      user_id: req.user.userId,
      action: 'link.status',
      entity_type: 'link',
      entity_id: rows[0].id,
      metadata: { short_code: rows[0].short_code, active },
    });

    const { baseUrl } = await resolveUserBaseUrl(req.user.userId);
    return res.json({ success: true, data: shapeLink(rows[0], baseUrl) });
  } catch (e) {
    console.error('updateLinkStatus error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * DELETE /api/links/:shortCode
 */
export async function deleteLink(req: UserReq, res: Response) {
  try {
    const orgId = req.org.orgId;
    const { shortCode } = req.params;
    const result = await db.query(
      `DELETE FROM links WHERE org_id = $1 AND short_code = $2`,
      [orgId, shortCode]
    );

    await logAudit({
      org_id: orgId,
      user_id: req.user.userId,
      action: 'link.delete',
      entity_type: 'link',
      entity_id: null,
      metadata: { short_code: shortCode, deleted: (result.rowCount ?? 0) > 0 },
    });
    return res.json({ success: true, data: { deleted: result.rowCount ? result.rowCount > 0 : false, short_code: shortCode } });
  } catch (e) {
    console.error('deleteLink error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// src/controllers/link.controller.ts
import { Request, Response } from 'express';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import db from '../config/database';
import { logAudit } from '../services/audit';
import { tryGrantReferralReward } from '../services/referrals';
import { getEffectivePlan, isPaidPlan } from '../services/plan';
import { invalidateCachedLinks, setCachedLink } from '../services/linkCache';

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

function normalizeDeepLink(raw: any): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    const scheme = u.protocol.replace(':', '').toLowerCase();
    if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) return null;
    if (['javascript', 'data'].includes(scheme)) return null;
    return value;
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

function normalizeShortCode(raw: string): string {
  return String(raw || '').trim().replace(/\s+/g, '');
}

async function isShortCodeTaken(code: string, excludeId?: string): Promise<boolean> {
  const q = excludeId
    ? `SELECT 1 FROM links WHERE LOWER(short_code) = LOWER($1) AND id <> $2 LIMIT 1`
    : `SELECT 1 FROM links WHERE LOWER(short_code) = LOWER($1) LIMIT 1`;
  const params = excludeId ? [code, excludeId] : [code];
  const { rows } = await db.query(q, params);
  return rows.length > 0;
}

function coreBaseUrl(): string {
  const raw = process.env.CORE_DOMAIN || process.env.PUBLIC_HOST || process.env.BASE_URL || 'https://okleaf.lnk';
  const base = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
  return base.replace(/\/+$/, '');
}

function shapeLink(row: any, coreBase: string) {
  const domain = row.domain || null;
  const baseUrl = domain ? `https://${domain}` : coreBase;
  const tags = Array.isArray(row.tags) ? row.tags : (row.tags ? row.tags : []);
  const groups = Array.isArray(row.groups) ? row.groups : (row.groups ? row.groups : []);
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
    domain,
    password_protected: Boolean(row.password_protected),
    deep_link_url: row.deep_link_url ?? null,
    ios_fallback_url: row.ios_fallback_url ?? null,
    android_fallback_url: row.android_fallback_url ?? null,
    deep_link_enabled: row.deep_link_enabled === true,
    tags,
    groups,
  };
}

async function fetchTags(orgId: string, tagIds: string[]) {
  if (!tagIds.length) return [];
  const { rows } = await db.query(
    `SELECT id, name, color
       FROM link_tags
      WHERE org_id = $1 AND id = ANY($2::uuid[])`,
    [orgId, tagIds]
  );
  return rows;
}

async function fetchGroups(orgId: string, groupIds: string[]) {
  if (!groupIds.length) return [];
  const { rows } = await db.query(
    `SELECT id, name, description
       FROM link_groups
      WHERE org_id = $1 AND id = ANY($2::uuid[])`,
    [orgId, groupIds]
  );
  return rows;
}

async function setLinkTags(linkId: string, tagIds: string[]) {
  await db.query(`DELETE FROM link_tag_links WHERE link_id = $1`, [linkId]);
  if (!tagIds.length) return;
  await db.query(
    `INSERT INTO link_tag_links (tag_id, link_id)
     SELECT UNNEST($1::uuid[]), $2`,
    [tagIds, linkId]
  );
}

async function setLinkGroups(linkId: string, groupIds: string[]) {
  await db.query(`DELETE FROM link_group_links WHERE link_id = $1`, [linkId]);
  if (!groupIds.length) return;
  await db.query(
    `INSERT INTO link_group_links (group_id, link_id)
     SELECT UNNEST($1::uuid[]), $2`,
    [groupIds, linkId]
  );
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
    const {
      url,
      title,
      short_code,
      expires_at,
      domain_id,
      tag_ids,
      group_ids,
      password,
      deep_link_url,
      ios_fallback_url,
      android_fallback_url,
      deep_link_enabled,
    } = req.body ?? {};
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

    const normalizedUrl = ensureHttpUrl(String(url).trim());
    if (!normalizedUrl) {
      return res.status(400).json({ success: false, error: 'URL must be http(s)' });
    }

    const autoTitle = parseHostnameFromUrl(normalizedUrl) || 'link';

    const rawCode = short_code ? String(short_code) : '';
    let code = rawCode ? normalizeShortCode(rawCode) : '';
    if (rawCode) {
      const v = validateCustomCode(code);
      if (!v.ok) return res.status(400).json({ success: false, error: v.error });
      if (await isShortCodeTaken(code)) {
        return res.status(409).json({ success: false, error: 'short_code already exists' });
      }
    }
    if (!rawCode) {
      let attempts = 0;
      do {
        code = nanoid(8);
        attempts += 1;
      } while ((RESERVED.has(code.toLowerCase()) || await isShortCodeTaken(code)) && attempts < 5);
      if (await isShortCodeTaken(code)) {
        return res.status(500).json({ success: false, error: 'Failed to generate a unique short_code' });
      }
    }

    const tagIds = Array.isArray(tag_ids) ? tag_ids.filter(Boolean) : [];
    const groupIds = Array.isArray(group_ids) ? group_ids.filter(Boolean) : [];
    if (tagIds.length) {
      const tags = await fetchTags(orgId, tagIds);
      if (tags.length !== tagIds.length) {
        return res.status(400).json({ success: false, error: 'One or more tags are invalid' });
      }
    }
    if (groupIds.length) {
      const groups = await fetchGroups(orgId, groupIds);
      if (groups.length !== groupIds.length) {
        return res.status(400).json({ success: false, error: 'One or more groups are invalid' });
      }
    }

    const coreBase = coreBaseUrl();
    let domainId: string | null = null;
    let domainHost: string | null = null;
    let passwordHash: string | null = null;
    let deepLinkUrl: string | null = null;
    let iosFallbackUrl: string | null = null;
    let androidFallbackUrl: string | null = null;
    let deepLinkEnabled = false;

    if (domain_id) {
      const plan = await getEffectivePlan(userId, orgId);
      if (!isPaidPlan(plan)) {
        return res.status(403).json({ success: false, error: 'Custom domains require a paid plan' });
      }

      const { rows: domainRows } = await db.query(
        `SELECT id, domain, is_active, verified
           FROM domains
          WHERE id = $1 AND org_id = $2
          LIMIT 1`,
        [domain_id, orgId],
      );
      if (!domainRows.length) {
        return res.status(400).json({ success: false, error: 'Domain not found' });
      }
      const d = domainRows[0];
      if (!d.is_active) return res.status(400).json({ success: false, error: 'Domain is not active' });
      if (!d.verified) return res.status(400).json({ success: false, error: 'Domain is not verified' });
      domainId = d.id;
      domainHost = d.domain;
    }

    if (password) {
      const raw = String(password).trim();
      if (raw.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      }
      passwordHash = await bcrypt.hash(raw, 12);
    }

    if (deep_link_url) {
      deepLinkUrl = normalizeDeepLink(deep_link_url);
      if (!deepLinkUrl) {
        return res.status(400).json({ success: false, error: 'Deep link URL is invalid' });
      }
    }
    if (ios_fallback_url !== undefined) {
      iosFallbackUrl = ios_fallback_url ? ensureHttpUrl(String(ios_fallback_url).trim()) : null;
      if (ios_fallback_url && !iosFallbackUrl) {
        return res.status(400).json({ success: false, error: 'iOS fallback must be http(s)' });
      }
    }
    if (android_fallback_url !== undefined) {
      androidFallbackUrl = android_fallback_url ? ensureHttpUrl(String(android_fallback_url).trim()) : null;
      if (android_fallback_url && !androidFallbackUrl) {
        return res.status(400).json({ success: false, error: 'Android fallback must be http(s)' });
      }
    }
    deepLinkEnabled = Boolean(deep_link_enabled) || Boolean(deepLinkUrl);

    await db.query('BEGIN');
    const q = `
      INSERT INTO links (org_id, user_id, short_code, original_url, title, domain_id, expires_at, active, password_hash,
                         deep_link_url, ios_fallback_url, android_fallback_url, deep_link_enabled)
      VALUES ($1, $2, $3, $4, COALESCE($5, $6), $7, $8, true, $9, $10, $11, $12, $13)
      RETURNING id, user_id, short_code, original_url, title, click_count, created_at, expires_at, active,
                (password_hash IS NOT NULL) AS password_protected,
                deep_link_url, ios_fallback_url, android_fallback_url, deep_link_enabled
    `;
    const { rows } = await db.query(q, [
      orgId,
      userId,
      code,
      normalizedUrl,
      title ?? null,
      autoTitle,
      domainId,
      expires_at ?? null,
      passwordHash,
      deepLinkUrl,
      iosFallbackUrl,
      androidFallbackUrl,
      deepLinkEnabled,
    ]);
    const linkId = rows[0].id as string;
    await setLinkTags(linkId, tagIds);
    await setLinkGroups(linkId, groupIds);
    await db.query('COMMIT');

    await logAudit({
      org_id: orgId,
      user_id: userId,
      action: 'link.create',
      entity_type: 'link',
      entity_id: rows[0].id,
      metadata: { short_code: rows[0].short_code },
    });

    try { await tryGrantReferralReward(userId, orgId); } catch (err) { console.error('referral reward error:', err); }
    void setCachedLink(code, {
      id: rows[0].id,
      original_url: rows[0].original_url,
      expires_at: rows[0].expires_at,
      active: rows[0].active !== false,
      password_hash: passwordHash,
      deep_link_url: deepLinkUrl,
      ios_fallback_url: iosFallbackUrl,
      android_fallback_url: androidFallbackUrl,
      deep_link_enabled: deepLinkEnabled,
      variants: [],
    });
    const tagRows = tagIds.length ? await fetchTags(orgId, tagIds) : [];
    const groupRows = groupIds.length ? await fetchGroups(orgId, groupIds) : [];
    return res.status(201).json({
      success: true,
      data: shapeLink({ ...rows[0], domain: domainHost, tags: tagRows, groups: groupRows }, coreBase),
    });
  } catch (e: any) {
    try { await db.query('ROLLBACK'); } catch {}
    if (e?.code === '23505') {
      return res.status(409).json({ success: false, error: 'short_code already exists' });
    }
    console.error('createLink error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/links/availability/:shortCode
 * Check if a short code is available globally (for core domain).
 */
export async function checkAvailability(req: UserReq, res: Response) {
  try {
    const raw = String(req.params?.shortCode || '');
    const code = normalizeShortCode(raw);
    if (!code) {
      return res.status(400).json({ success: false, error: 'short_code is required' });
    }

    const v = validateCustomCode(code);
    if (!v.ok) {
      return res.json({ success: true, data: { available: false, code, reason: v.error } });
    }

    const taken = await isShortCodeTaken(code);
    if (taken) {
      return res.json({ success: true, data: { available: false, code, reason: 'short_code already exists' } });
    }

    return res.json({ success: true, data: { available: true, code } });
  } catch (e) {
    console.error('checkAvailability error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/links/core-domain
 */
export async function getCoreDomain(req: UserReq, res: Response) {
  const baseUrl = coreBaseUrl();
  try {
    const host = new URL(baseUrl).host;
    return res.json({ success: true, data: { base_url: baseUrl, host } });
  } catch {
    return res.json({ success: true, data: { base_url: baseUrl, host: baseUrl.replace(/^https?:\/\//, '') } });
  }
}

/**
 * GET /api/links
 */
export async function getUserLinks(req: UserReq, res: Response) {
  try {
    const orgId = req.org.orgId;
    const coreBase = coreBaseUrl();
    const { rows } = await db.query(
      `SELECT l.id, l.user_id, l.short_code, l.original_url, l.title, l.click_count, l.created_at, l.expires_at, l.active,
              d.domain AS domain,
              (l.password_hash IS NOT NULL) AS password_protected,
              l.deep_link_url, l.ios_fallback_url, l.android_fallback_url, l.deep_link_enabled,
              COALESCE(
                (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
                   FROM link_tag_links ltl
                   JOIN link_tags t ON t.id = ltl.tag_id
                  WHERE ltl.link_id = l.id), '[]'::json) AS tags,
              COALESCE(
                (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'description', g.description) ORDER BY g.name)
                   FROM link_group_links lgl
                   JOIN link_groups g ON g.id = lgl.group_id
                  WHERE lgl.link_id = l.id), '[]'::json) AS groups
         FROM links l
         LEFT JOIN domains d ON d.id = l.domain_id
        WHERE l.org_id = $1
        ORDER BY l.created_at DESC`,
      [orgId]
    );
    return res.json({ success: true, data: rows.map(r => shapeLink(r, coreBase)) });
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
      `SELECT l.id, l.user_id, l.short_code, l.original_url, l.title, l.click_count, l.created_at, l.expires_at, l.active,
              d.domain AS domain,
              (l.password_hash IS NOT NULL) AS password_protected,
              l.deep_link_url, l.ios_fallback_url, l.android_fallback_url, l.deep_link_enabled,
              COALESCE(
                (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
                   FROM link_tag_links ltl
                   JOIN link_tags t ON t.id = ltl.tag_id
                  WHERE ltl.link_id = l.id), '[]'::json) AS tags,
              COALESCE(
                (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'description', g.description) ORDER BY g.name)
                   FROM link_group_links lgl
                   JOIN link_groups g ON g.id = lgl.group_id
                  WHERE lgl.link_id = l.id), '[]'::json) AS groups
         FROM links l
         LEFT JOIN domains d ON d.id = l.domain_id
        WHERE l.org_id = $1 AND l.short_code = $2`,
      [orgId, shortCode]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Link not found' });

    const coreBase = coreBaseUrl();
    return res.json({ success: true, data: shapeLink(rows[0], coreBase) });
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
    const {
      url,
      title,
      expires_at,
      short_code,
      tag_ids,
      group_ids,
      password,
      clear_password,
      deep_link_url,
      ios_fallback_url,
      android_fallback_url,
      deep_link_enabled,
    } = req.body ?? {};

    const { rows: existing } = await db.query(
      `SELECT id FROM links WHERE org_id = $1 AND short_code = $2`,
      [orgId, shortCode]
    );
    if (!existing.length) return res.status(404).json({ success: false, error: 'Link not found' });
    const existingId = existing[0].id;

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
    let newCodeValue: string | null = null;
    if (short_code !== undefined) {
      const newCode = normalizeShortCode(short_code);
      const v = validateCustomCode(newCode);
      if (!v.ok) return res.status(400).json({ success: false, error: v.error });
      if (await isShortCodeTaken(newCode, existingId)) {
        return res.status(409).json({ success: false, error: 'short_code already exists' });
      }
      sets.push(`short_code = $${i++}`); vals.push(newCode);
      newCodeValue = newCode;
    }

    const tagIds = Array.isArray(tag_ids) ? tag_ids.filter(Boolean) : null;
    const groupIds = Array.isArray(group_ids) ? group_ids.filter(Boolean) : null;
    if (tagIds !== null) {
      const tags = await fetchTags(orgId, tagIds);
      if (tags.length !== tagIds.length) {
        return res.status(400).json({ success: false, error: 'One or more tags are invalid' });
      }
    }
    if (groupIds !== null) {
      const groups = await fetchGroups(orgId, groupIds);
      if (groups.length !== groupIds.length) {
        return res.status(400).json({ success: false, error: 'One or more groups are invalid' });
      }
    }

    if (clear_password) {
      sets.push(`password_hash = NULL`);
    } else if (password) {
      const raw = String(password).trim();
      if (raw.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      }
      const passwordHash = await bcrypt.hash(raw, 12);
      sets.push(`password_hash = $${i++}`);
      vals.push(passwordHash);
    }

    if (deep_link_url !== undefined) {
      if (!deep_link_url) {
        sets.push(`deep_link_url = NULL`);
        sets.push(`deep_link_enabled = false`);
      } else {
        const normalized = normalizeDeepLink(deep_link_url);
        if (!normalized) {
          return res.status(400).json({ success: false, error: 'Deep link URL is invalid' });
        }
        sets.push(`deep_link_url = $${i++}`);
        vals.push(normalized);
      }
    }
    if (ios_fallback_url !== undefined) {
      const normalized = ios_fallback_url ? ensureHttpUrl(String(ios_fallback_url).trim()) : null;
      if (ios_fallback_url && !normalized) {
        return res.status(400).json({ success: false, error: 'iOS fallback must be http(s)' });
      }
      sets.push(`ios_fallback_url = $${i++}`);
      vals.push(normalized);
    }
    if (android_fallback_url !== undefined) {
      const normalized = android_fallback_url ? ensureHttpUrl(String(android_fallback_url).trim()) : null;
      if (android_fallback_url && !normalized) {
        return res.status(400).json({ success: false, error: 'Android fallback must be http(s)' });
      }
      sets.push(`android_fallback_url = $${i++}`);
      vals.push(normalized);
    }
    if (typeof deep_link_enabled === 'boolean') {
      if (deep_link_enabled && deep_link_url === undefined) {
        const hasExisting = await db.query(
          `SELECT deep_link_url FROM links WHERE org_id = $1 AND short_code = $2 LIMIT 1`,
          [orgId, shortCode]
        );
        if (!hasExisting.rows[0]?.deep_link_url) {
          return res.status(400).json({ success: false, error: 'Deep link URL required to enable' });
        }
      }
      sets.push(`deep_link_enabled = $${i++}`);
      vals.push(deep_link_enabled);
    }

    if (!sets.length && tagIds === null && groupIds === null) {
      return res.json({ success: true, data: { updated: false } });
    }

    await db.query('BEGIN');
    let rows: any[] = [];
    if (sets.length) {
      vals.push(orgId, shortCode);
      const q = `
        UPDATE links
           SET ${sets.join(', ')}
         WHERE org_id = $${i++} AND short_code = $${i++}
        RETURNING id, user_id, short_code, original_url, title, click_count, created_at, expires_at, active,
                  (SELECT domain FROM domains d WHERE d.id = links.domain_id) AS domain,
                  (password_hash IS NOT NULL) AS password_protected,
                  deep_link_url, ios_fallback_url, android_fallback_url, deep_link_enabled,
                  COALESCE(
                    (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
                       FROM link_tag_links ltl
                       JOIN link_tags t ON t.id = ltl.tag_id
                      WHERE ltl.link_id = links.id), '[]'::json) AS tags,
                  COALESCE(
                    (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'description', g.description) ORDER BY g.name)
                       FROM link_group_links lgl
                       JOIN link_groups g ON g.id = lgl.group_id
                      WHERE lgl.link_id = links.id), '[]'::json) AS groups
      `;
      const result = await db.query(q, vals);
      rows = result.rows;
    } else {
      const result = await db.query(
        `SELECT l.id, l.user_id, l.short_code, l.original_url, l.title, l.click_count, l.created_at, l.expires_at, l.active,
                (SELECT domain FROM domains d WHERE d.id = l.domain_id) AS domain,
                (l.password_hash IS NOT NULL) AS password_protected,
                l.deep_link_url, l.ios_fallback_url, l.android_fallback_url, l.deep_link_enabled,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
                     FROM link_tag_links ltl
                     JOIN link_tags t ON t.id = ltl.tag_id
                    WHERE ltl.link_id = l.id), '[]'::json) AS tags,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'description', g.description) ORDER BY g.name)
                     FROM link_group_links lgl
                     JOIN link_groups g ON g.id = lgl.group_id
                    WHERE lgl.link_id = l.id), '[]'::json) AS groups
           FROM links l
          WHERE l.org_id = $1 AND l.short_code = $2
          LIMIT 1`,
        [orgId, shortCode]
      );
      rows = result.rows;
    }
    const linkId = rows[0].id as string;
    if (tagIds !== null) await setLinkTags(linkId, tagIds);
    if (groupIds !== null) await setLinkGroups(linkId, groupIds);
    if (tagIds !== null || groupIds !== null) {
      const refreshed = await db.query(
        `SELECT l.id, l.user_id, l.short_code, l.original_url, l.title, l.click_count, l.created_at, l.expires_at, l.active,
                (SELECT domain FROM domains d WHERE d.id = l.domain_id) AS domain,
                (l.password_hash IS NOT NULL) AS password_protected,
                l.deep_link_url, l.ios_fallback_url, l.android_fallback_url, l.deep_link_enabled,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
                     FROM link_tag_links ltl
                     JOIN link_tags t ON t.id = ltl.tag_id
                    WHERE ltl.link_id = l.id), '[]'::json) AS tags,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'description', g.description) ORDER BY g.name)
                     FROM link_group_links lgl
                     JOIN link_groups g ON g.id = lgl.group_id
                    WHERE lgl.link_id = l.id), '[]'::json) AS groups
           FROM links l
          WHERE l.id = $1
          LIMIT 1`,
        [linkId]
      );
      rows = refreshed.rows;
    }
    await db.query('COMMIT');

    await logAudit({
      org_id: orgId,
      user_id: req.user.userId,
      action: 'link.update',
      entity_type: 'link',
      entity_id: rows[0].id,
      metadata: { short_code: rows[0].short_code },
    });

    const invalidate = newCodeValue ? [shortCode, newCodeValue] : [shortCode];
    void invalidateCachedLinks(invalidate);
    const coreBase = coreBaseUrl();
    return res.json({ success: true, data: shapeLink(rows[0], coreBase) });
  } catch (e: any) {
    try { await db.query('ROLLBACK'); } catch {}
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
      RETURNING id, user_id, short_code, original_url, title, click_count, created_at, expires_at, active,
                (SELECT domain FROM domains d WHERE d.id = links.domain_id) AS domain,
                (password_hash IS NOT NULL) AS password_protected,
                deep_link_url, ios_fallback_url, android_fallback_url, deep_link_enabled,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name)
                     FROM link_tag_links ltl
                     JOIN link_tags t ON t.id = ltl.tag_id
                    WHERE ltl.link_id = links.id), '[]'::json) AS tags,
                COALESCE(
                  (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'description', g.description) ORDER BY g.name)
                     FROM link_group_links lgl
                     JOIN link_groups g ON g.id = lgl.group_id
                    WHERE lgl.link_id = links.id), '[]'::json) AS groups`,
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

    void invalidateCachedLinks([shortCode]);
    const coreBase = coreBaseUrl();
    return res.json({ success: true, data: shapeLink(rows[0], coreBase) });
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
    void invalidateCachedLinks([shortCode]);
    return res.json({ success: true, data: { deleted: result.rowCount ? result.rowCount > 0 : false, short_code: shortCode } });
  } catch (e) {
    console.error('deleteLink error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * POST /api/links/bulk-create
 * Body: { items: [{ url, title? }], domain_id?, tag_ids?, group_ids?, password? }
 */
export async function bulkCreateLinks(req: UserReq, res: Response) {
  try {
    const userId = req.user.userId;
    const orgId = req.org.orgId;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const domainId = req.body?.domain_id || null;
    const tagIds = Array.isArray(req.body?.tag_ids) ? req.body.tag_ids.filter(Boolean) : [];
    const groupIds = Array.isArray(req.body?.group_ids) ? req.body.group_ids.filter(Boolean) : [];
    const password = req.body?.password ? String(req.body.password).trim() : '';
    const deepLinkUrl = req.body?.deep_link_url ? normalizeDeepLink(req.body.deep_link_url) : null;
    const iosFallbackUrl = req.body?.ios_fallback_url ? ensureHttpUrl(String(req.body.ios_fallback_url).trim()) : null;
    const androidFallbackUrl = req.body?.android_fallback_url ? ensureHttpUrl(String(req.body.android_fallback_url).trim()) : null;
    const deepLinkEnabled = Boolean(req.body?.deep_link_enabled) || Boolean(deepLinkUrl);
    if (!items.length) return res.status(400).json({ success: false, error: 'items are required' });

    if (tagIds.length) {
      const tags = await fetchTags(orgId, tagIds);
      if (tags.length !== tagIds.length) {
        return res.status(400).json({ success: false, error: 'One or more tags are invalid' });
      }
    }
    if (groupIds.length) {
      const groups = await fetchGroups(orgId, groupIds);
      if (groups.length !== groupIds.length) {
        return res.status(400).json({ success: false, error: 'One or more groups are invalid' });
      }
    }

    if (req.body?.deep_link_url && !deepLinkUrl) {
      return res.status(400).json({ success: false, error: 'Deep link URL is invalid' });
    }
    if (req.body?.ios_fallback_url && !iosFallbackUrl) {
      return res.status(400).json({ success: false, error: 'iOS fallback must be http(s)' });
    }
    if (req.body?.android_fallback_url && !androidFallbackUrl) {
      return res.status(400).json({ success: false, error: 'Android fallback must be http(s)' });
    }

    let domainHost: string | null = null;
    let resolvedDomainId: string | null = null;
    if (domainId) {
      const plan = await getEffectivePlan(userId, orgId);
      if (!isPaidPlan(plan)) {
        return res.status(403).json({ success: false, error: 'Custom domains require a paid plan' });
      }
      const { rows: domainRows } = await db.query(
        `SELECT id, domain, is_active, verified
           FROM domains
          WHERE id = $1 AND org_id = $2
          LIMIT 1`,
        [domainId, orgId],
      );
      if (!domainRows.length) {
        return res.status(400).json({ success: false, error: 'Domain not found' });
      }
      const d = domainRows[0];
      if (!d.is_active) return res.status(400).json({ success: false, error: 'Domain is not active' });
      if (!d.verified) return res.status(400).json({ success: false, error: 'Domain is not verified' });
      resolvedDomainId = d.id;
      domainHost = d.domain;
    }

    let passwordHash: string | null = null;
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      }
      passwordHash = await bcrypt.hash(password, 12);
    }

    const coreBase = coreBaseUrl();
    const results: any[] = [];
    for (const item of items) {
      const rawUrl = String(item?.url || '').trim();
      const title = item?.title ? String(item.title).trim() : null;
      if (!rawUrl) {
        results.push({ url: rawUrl, success: false, error: 'Missing URL' });
        continue;
      }
      const normalizedUrl = ensureHttpUrl(rawUrl);
      if (!normalizedUrl) {
        results.push({ url: rawUrl, success: false, error: 'URL must be http(s)' });
        continue;
      }

      let code = '';
      let attempts = 0;
      do {
        code = nanoid(8);
        attempts += 1;
      } while ((RESERVED.has(code.toLowerCase()) || await isShortCodeTaken(code)) && attempts < 5);
      if (await isShortCodeTaken(code)) {
        results.push({ url: rawUrl, success: false, error: 'Failed to generate code' });
        continue;
      }

      const autoTitle = parseHostnameFromUrl(normalizedUrl) || 'link';
      await db.query('BEGIN');
      try {
        const { rows } = await db.query(
          `INSERT INTO links (org_id, user_id, short_code, original_url, title, domain_id, active, password_hash,
                              deep_link_url, ios_fallback_url, android_fallback_url, deep_link_enabled)
           VALUES ($1, $2, $3, $4, COALESCE($5, $6), $7, true, $8, $9, $10, $11, $12)
           RETURNING id, short_code, original_url, title, click_count, created_at, expires_at, active,
                     (password_hash IS NOT NULL) AS password_protected,
                     deep_link_url, ios_fallback_url, android_fallback_url, deep_link_enabled`,
          [
            orgId,
            userId,
            code,
            normalizedUrl,
            title,
            autoTitle,
            resolvedDomainId,
            passwordHash,
            deepLinkUrl,
            iosFallbackUrl,
            androidFallbackUrl,
            deepLinkEnabled,
          ],
        );
        const linkId = rows[0].id as string;
        await setLinkTags(linkId, tagIds);
        await setLinkGroups(linkId, groupIds);
        await db.query('COMMIT');
        const tagRows = tagIds.length ? await fetchTags(orgId, tagIds) : [];
        const groupRows = groupIds.length ? await fetchGroups(orgId, groupIds) : [];
        results.push({
          success: true,
          data: shapeLink({ ...rows[0], domain: domainHost, tags: tagRows, groups: groupRows }, coreBase),
        });
      } catch (err) {
        try { await db.query('ROLLBACK'); } catch {}
        results.push({ url: rawUrl, success: false, error: 'Insert failed' });
      }
    }

    return res.json({ success: true, data: results });
  } catch (err) {
    console.error('bulkCreate error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * POST /api/links/bulk-delete
 * Body: { codes: string[] }
 */
export async function bulkDeleteLinks(req: UserReq, res: Response) {
  try {
    const orgId = req.org.orgId;
    const codes = Array.isArray(req.body?.codes)
      ? req.body.codes.map((c: any) => normalizeShortCode(c)).filter(Boolean)
      : [];
    if (!codes.length) return res.status(400).json({ success: false, error: 'codes are required' });

    const { rows } = await db.query(
      `DELETE FROM links WHERE org_id = $1 AND short_code = ANY($2::text[])
       RETURNING short_code`,
      [orgId, codes]
    );
    const deleted = rows.map((r) => r.short_code);
    void invalidateCachedLinks(deleted);
    return res.json({ success: true, data: { deleted, count: deleted.length } });
  } catch (err) {
    console.error('bulkDelete error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/links/:shortCode/variants
 */
export async function listVariants(req: UserReq, res: Response) {
  try {
    const orgId = req.org.orgId;
    const { shortCode } = req.params;
    const { rows: linkRows } = await db.query(
      `SELECT id FROM links WHERE org_id = $1 AND short_code = $2 LIMIT 1`,
      [orgId, shortCode]
    );
    if (!linkRows.length) return res.status(404).json({ success: false, error: 'Link not found' });
    const linkId = linkRows[0].id as string;
    const { rows } = await db.query(
      `SELECT id, url, weight, active, created_at
         FROM link_variants
        WHERE link_id = $1
        ORDER BY created_at ASC`,
      [linkId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('variants.list error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * PUT /api/links/:shortCode/variants
 * Body: { variants: [{ url, weight, active }] }
 */
export async function replaceVariants(req: UserReq, res: Response) {
  try {
    const orgId = req.org.orgId;
    const userId = req.user.userId;
    const { shortCode } = req.params;
    const variants = Array.isArray(req.body?.variants) ? req.body.variants : [];

    const { rows: linkRows } = await db.query(
      `SELECT id FROM links WHERE org_id = $1 AND short_code = $2 LIMIT 1`,
      [orgId, shortCode]
    );
    if (!linkRows.length) return res.status(404).json({ success: false, error: 'Link not found' });
    const linkId = linkRows[0].id as string;

    const cleaned = variants.map((v: any) => ({
      url: ensureHttpUrl(String(v?.url || '').trim()),
      weight: Number(v?.weight || 1),
      active: v?.active !== false,
    }));
    for (const v of cleaned) {
      if (!v.url) return res.status(400).json({ success: false, error: 'All variant URLs must be valid http(s)' });
      if (!Number.isFinite(v.weight) || v.weight < 1 || v.weight > 1000) {
        return res.status(400).json({ success: false, error: 'Variant weight must be 1-1000' });
      }
    }

    await db.query('BEGIN');
    await db.query(`DELETE FROM link_variants WHERE link_id = $1`, [linkId]);
    if (cleaned.length) {
      const values: any[] = [];
      const placeholders = cleaned.map((v: { url: string; weight: number; active: boolean }, idx: number) => {
        const base = idx * 4;
        values.push(linkId, v.url, v.weight, v.active);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      });
      await db.query(
        `INSERT INTO link_variants (link_id, url, weight, active)
         VALUES ${placeholders.join(', ')}`,
        values
      );
    }
    await db.query('COMMIT');

    await logAudit({
      org_id: orgId,
      user_id: userId,
      action: 'link.variants.update',
      entity_type: 'link',
      entity_id: linkId,
      metadata: { count: cleaned.length },
    });
    void invalidateCachedLinks([shortCode]);

    const { rows } = await db.query(
      `SELECT id, url, weight, active, created_at
         FROM link_variants
        WHERE link_id = $1
        ORDER BY created_at ASC`,
      [linkId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch {}
    console.error('variants.replace error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

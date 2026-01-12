import type { Request, Response } from 'express';
import db from '../config/database';
import type { OrgRequest } from '../middleware/org';
import { log } from '../utils/logger';
import { getEffectivePlan } from '../services/plan';
import { getPlanEntitlements, isFeatureEnabled } from '../services/entitlements';

const DEFAULT_THEME = {
  bg: '#0b0d10',
  card: '#151c26',
  text: '#f5f1e8',
  muted: '#b8b3a9',
  accent: '#e0b15a',
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeSlug(raw: unknown) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function ensureHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function normalizeTheme(input: any) {
  const theme = input && typeof input === 'object' ? input : {};
  return {
    bg: theme.bg || DEFAULT_THEME.bg,
    card: theme.card || DEFAULT_THEME.card,
    text: theme.text || DEFAULT_THEME.text,
    muted: theme.muted || DEFAULT_THEME.muted,
    accent: theme.accent || DEFAULT_THEME.accent,
  };
}

async function requireBioEntitlement(req: OrgRequest) {
  const orgId = req.org!.orgId;
  const plan = await getEffectivePlan(req.user?.userId || '', orgId);
  const entitlements = await getPlanEntitlements(plan);
  return isFeatureEnabled(entitlements, 'link_in_bio');
}

export async function listBioPages(req: OrgRequest, res: Response) {
  try {
    if (!(await requireBioEntitlement(req))) {
      return res.status(403).json({ success: false, error: 'Link-in-bio requires an upgraded plan' });
    }
    const orgId = req.org!.orgId;
    const { rows } = await db.query(
      `SELECT p.id, p.slug, p.title, p.description, p.avatar_url, p.is_active,
              p.created_at, p.updated_at,
              (SELECT COUNT(*)::int FROM bio_links bl WHERE bl.page_id = p.id) AS link_count
         FROM bio_pages p
        WHERE p.org_id = $1
        ORDER BY p.created_at DESC`,
      [orgId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'bio.list error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function getBioPage(req: OrgRequest, res: Response) {
  try {
    if (!(await requireBioEntitlement(req))) {
      return res.status(403).json({ success: false, error: 'Link-in-bio requires an upgraded plan' });
    }
    const orgId = req.org!.orgId;
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT id, slug, title, description, avatar_url, theme, cta_label, cta_url, is_active, created_at, updated_at
         FROM bio_pages
        WHERE org_id = $1 AND id = $2
        LIMIT 1`,
      [orgId, id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Page not found' });
    const page = rows[0];
    const links = await db.query(
      `SELECT id, label, url, icon, sort_order, is_active, click_count, created_at, updated_at
         FROM bio_links
        WHERE page_id = $1
        ORDER BY sort_order ASC, created_at ASC`,
      [page.id]
    );
    return res.json({ success: true, data: { ...page, links: links.rows } });
  } catch (err) {
    log('error', 'bio.get error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createBioPage(req: OrgRequest, res: Response) {
  try {
    if (!(await requireBioEntitlement(req))) {
      return res.status(403).json({ success: false, error: 'Link-in-bio requires an upgraded plan' });
    }
    const orgId = req.org!.orgId;
    const userId = req.user?.userId ?? null;
    const slug = normalizeSlug(req.body?.slug);
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const avatarUrl = String(req.body?.avatar_url || '').trim();
    const ctaLabel = String(req.body?.cta_label || '').trim();
    const ctaUrl = String(req.body?.cta_url || '').trim();
    const isActive = req.body?.is_active !== false;
    if (!slug || slug.length < 3) {
      return res.status(400).json({ success: false, error: 'slug must be at least 3 characters' });
    }
    if (!title) return res.status(400).json({ success: false, error: 'title is required' });
    if (ctaUrl && !ensureHttpUrl(ctaUrl)) {
      return res.status(400).json({ success: false, error: 'cta_url must be http(s)' });
    }
    const theme = normalizeTheme(req.body?.theme || {});

    const { rows } = await db.query(
      `INSERT INTO bio_pages (org_id, user_id, slug, title, description, avatar_url, theme, cta_label, cta_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
       RETURNING id, slug, title, description, avatar_url, theme, cta_label, cta_url, is_active, created_at, updated_at`,
      [orgId, userId, slug, title, description || null, avatarUrl || null, JSON.stringify(theme), ctaLabel || null, ctaUrl || null, isActive]
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
    if (code === '23505') {
      return res.status(409).json({ success: false, error: 'slug already exists' });
    }
    log('error', 'bio.create error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateBioPage(req: OrgRequest, res: Response) {
  try {
    if (!(await requireBioEntitlement(req))) {
      return res.status(403).json({ success: false, error: 'Link-in-bio requires an upgraded plan' });
    }
    const orgId = req.org!.orgId;
    const { id } = req.params;
    const slug = req.body?.slug ? normalizeSlug(req.body?.slug) : null;
    const title = req.body?.title ? String(req.body.title).trim() : null;
    const description = req.body?.description ? String(req.body.description).trim() : null;
    const avatarUrl = req.body?.avatar_url ? String(req.body.avatar_url).trim() : null;
    const ctaLabel = req.body?.cta_label ? String(req.body.cta_label).trim() : null;
    const ctaUrl = req.body?.cta_url ? String(req.body.cta_url).trim() : null;
    const isActive = typeof req.body?.is_active === 'boolean' ? req.body.is_active : null;

    if (slug !== null && slug.length < 3) {
      return res.status(400).json({ success: false, error: 'slug must be at least 3 characters' });
    }
    if (ctaUrl && !ensureHttpUrl(ctaUrl)) {
      return res.status(400).json({ success: false, error: 'cta_url must be http(s)' });
    }
    const theme = req.body?.theme ? normalizeTheme(req.body.theme) : null;

    const { rows } = await db.query(
      `UPDATE bio_pages
          SET slug = COALESCE($1, slug),
              title = COALESCE($2, title),
              description = COALESCE($3, description),
              avatar_url = COALESCE($4, avatar_url),
              theme = COALESCE($5::jsonb, theme),
              cta_label = COALESCE($6, cta_label),
              cta_url = COALESCE($7, cta_url),
              is_active = COALESCE($8, is_active),
              updated_at = NOW()
        WHERE org_id = $9 AND id = $10
        RETURNING id, slug, title, description, avatar_url, theme, cta_label, cta_url, is_active, created_at, updated_at`,
      [
        slug,
        title,
        description,
        avatarUrl,
        theme ? JSON.stringify(theme) : null,
        ctaLabel,
        ctaUrl,
        isActive,
        orgId,
        id,
      ]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Page not found' });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
    if (code === '23505') {
      return res.status(409).json({ success: false, error: 'slug already exists' });
    }
    log('error', 'bio.update error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function deleteBioPage(req: OrgRequest, res: Response) {
  try {
    if (!(await requireBioEntitlement(req))) {
      return res.status(403).json({ success: false, error: 'Link-in-bio requires an upgraded plan' });
    }
    const orgId = req.org!.orgId;
    const { id } = req.params;
    const result = await db.query(`DELETE FROM bio_pages WHERE org_id = $1 AND id = $2`, [orgId, id]);
    return res.json({ success: true, data: { deleted: (result.rowCount ?? 0) > 0 } });
  } catch (err) {
    log('error', 'bio.delete error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createBioLink(req: OrgRequest, res: Response) {
  try {
    if (!(await requireBioEntitlement(req))) {
      return res.status(403).json({ success: false, error: 'Link-in-bio requires an upgraded plan' });
    }
    const orgId = req.org!.orgId;
    const { id } = req.params;
    const label = String(req.body?.label || '').trim();
    const url = ensureHttpUrl(String(req.body?.url || '').trim());
    const icon = String(req.body?.icon || '').trim();
    const isActive = req.body?.is_active !== false;
    if (!label) return res.status(400).json({ success: false, error: 'label is required' });
    if (!url) return res.status(400).json({ success: false, error: 'url must be http(s)' });

    const pageRes = await db.query(`SELECT id FROM bio_pages WHERE org_id = $1 AND id = $2 LIMIT 1`, [orgId, id]);
    if (!pageRes.rows.length) return res.status(404).json({ success: false, error: 'Page not found' });

    const orderRes = await db.query(`SELECT COALESCE(MAX(sort_order), 0) AS max FROM bio_links WHERE page_id = $1`, [id]);
    const nextOrder = Number(orderRes.rows[0]?.max || 0) + 10;
    const { rows } = await db.query(
      `INSERT INTO bio_links (page_id, label, url, icon, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, label, url, icon, sort_order, is_active, click_count, created_at, updated_at`,
      [id, label, url, icon || null, nextOrder, isActive]
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    log('error', 'bio.links.create error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateBioLink(req: OrgRequest, res: Response) {
  try {
    if (!(await requireBioEntitlement(req))) {
      return res.status(403).json({ success: false, error: 'Link-in-bio requires an upgraded plan' });
    }
    const orgId = req.org!.orgId;
    const { id, linkId } = req.params;
    const label = req.body?.label ? String(req.body.label).trim() : null;
    const url = req.body?.url ? ensureHttpUrl(String(req.body.url).trim()) : null;
    const icon = req.body?.icon ? String(req.body.icon).trim() : null;
    const isActive = typeof req.body?.is_active === 'boolean' ? req.body.is_active : null;

    if (req.body?.url && !url) return res.status(400).json({ success: false, error: 'url must be http(s)' });

    const pageRes = await db.query(`SELECT id FROM bio_pages WHERE org_id = $1 AND id = $2 LIMIT 1`, [orgId, id]);
    if (!pageRes.rows.length) return res.status(404).json({ success: false, error: 'Page not found' });

    const { rows } = await db.query(
      `UPDATE bio_links
          SET label = COALESCE($1, label),
              url = COALESCE($2, url),
              icon = COALESCE($3, icon),
              is_active = COALESCE($4, is_active),
              updated_at = NOW()
        WHERE page_id = $5 AND id = $6
        RETURNING id, label, url, icon, sort_order, is_active, click_count, created_at, updated_at`,
      [label, url, icon, isActive, id, linkId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Link not found' });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    log('error', 'bio.links.update error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function deleteBioLink(req: OrgRequest, res: Response) {
  try {
    if (!(await requireBioEntitlement(req))) {
      return res.status(403).json({ success: false, error: 'Link-in-bio requires an upgraded plan' });
    }
    const orgId = req.org!.orgId;
    const { id, linkId } = req.params;
    const pageRes = await db.query(`SELECT id FROM bio_pages WHERE org_id = $1 AND id = $2 LIMIT 1`, [orgId, id]);
    if (!pageRes.rows.length) return res.status(404).json({ success: false, error: 'Page not found' });
    const result = await db.query(`DELETE FROM bio_links WHERE page_id = $1 AND id = $2`, [id, linkId]);
    return res.json({ success: true, data: { deleted: (result.rowCount ?? 0) > 0 } });
  } catch (err) {
    log('error', 'bio.links.delete error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function reorderBioLinks(req: OrgRequest, res: Response) {
  try {
    if (!(await requireBioEntitlement(req))) {
      return res.status(403).json({ success: false, error: 'Link-in-bio requires an upgraded plan' });
    }
    const orgId = req.org!.orgId;
    const { id } = req.params;
    const order = Array.isArray(req.body?.order) ? req.body.order : [];
    if (!order.length) return res.status(400).json({ success: false, error: 'order is required' });

    const pageRes = await db.query(`SELECT id FROM bio_pages WHERE org_id = $1 AND id = $2 LIMIT 1`, [orgId, id]);
    if (!pageRes.rows.length) return res.status(404).json({ success: false, error: 'Page not found' });

    await db.query('BEGIN');
    for (const item of order) {
      if (!item?.id) continue;
      const sortOrder = Number(item.sort_order);
      if (!Number.isFinite(sortOrder)) continue;
      await db.query(
        `UPDATE bio_links SET sort_order = $1, updated_at = NOW() WHERE id = $2 AND page_id = $3`,
        [sortOrder, item.id, id]
      );
    }
    await db.query('COMMIT');
    return res.json({ success: true });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch {}
    log('error', 'bio.links.reorder error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function getPublicBioPage(req: Request, res: Response) {
  try {
    const slug = normalizeSlug(req.params?.slug);
    if (!slug) return res.status(404).send('Not found');
    const { rows } = await db.query(
      `SELECT id, slug, title, description, avatar_url, theme, cta_label, cta_url, is_active
         FROM bio_pages
        WHERE slug = $1 AND is_active = true
        LIMIT 1`,
      [slug]
    );
    if (!rows.length) return res.status(404).send('Not found');
    const page = rows[0];
    const linksRes = await db.query(
      `SELECT id, label, url, icon, sort_order, is_active
         FROM bio_links
        WHERE page_id = $1 AND is_active = true
        ORDER BY sort_order ASC, created_at ASC`,
      [page.id]
    );
    const theme = normalizeTheme(page.theme || {});
    const title = escapeHtml(page.title || 'Links');
    const description = escapeHtml(page.description || '');
    const avatar = page.avatar_url ? escapeHtml(page.avatar_url) : '';
    const ctaLabel = page.cta_label ? escapeHtml(page.cta_label) : '';
    const ctaUrl = page.cta_url ? escapeHtml(page.cta_url) : '';
    const items = linksRes.rows.map((link: any) => {
      const label = escapeHtml(link.label || '');
      const icon = link.icon ? `<span class="bio-icon">${escapeHtml(link.icon)}</span>` : '';
      return `<a class="bio-link" href="/b/${escapeHtml(page.slug)}/go/${escapeHtml(link.id)}" rel="noopener">${icon}<span>${label}</span></a>`;
    }).join('');

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: ${theme.bg};
      --card: ${theme.card};
      --text: ${theme.text};
      --muted: ${theme.muted};
      --accent: ${theme.accent};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Space Grotesk", system-ui, sans-serif;
      background: radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 45%), var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 16px;
    }
    .bio-shell {
      width: min(560px, 100%);
      background: color-mix(in srgb, var(--card) 92%, transparent);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 24px 70px rgba(0,0,0,0.35);
      display: grid;
      gap: 18px;
    }
    .bio-header { text-align: center; display: grid; gap: 10px; }
    .bio-avatar {
      width: 84px;
      height: 84px;
      border-radius: 50%;
      object-fit: cover;
      margin: 0 auto;
      border: 2px solid rgba(255,255,255,0.1);
    }
    .bio-title { font-size: 28px; font-weight: 700; margin: 0; }
    .bio-desc { margin: 0; color: var(--muted); line-height: 1.6; }
    .bio-links { display: grid; gap: 12px; }
    .bio-link {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      padding: 14px 18px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(10,12,16,0.45);
      color: var(--text);
      font-weight: 600;
      transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
    }
    .bio-link:hover {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, var(--accent) 70%, transparent);
      box-shadow: 0 12px 24px rgba(0,0,0,0.25);
    }
    .bio-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
      font-size: 14px;
    }
    .bio-cta {
      text-align: center;
      padding-top: 6px;
    }
    .bio-cta a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 22px;
      border-radius: 999px;
      background: var(--accent);
      color: #0b0d10;
      text-decoration: none;
      font-weight: 600;
    }
    .bio-footer {
      text-align: center;
      font-size: 12px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="bio-shell">
    <div class="bio-header">
      ${avatar ? `<img class="bio-avatar" src="${avatar}" alt="${title}">` : ''}
      <h1 class="bio-title">${title}</h1>
      ${description ? `<p class="bio-desc">${description}</p>` : ''}
    </div>
    <div class="bio-links">
      ${items || '<div class="bio-desc">No links published yet.</div>'}
    </div>
    ${ctaLabel && ctaUrl ? `<div class="bio-cta"><a href="${ctaUrl}" rel="noopener">${ctaLabel}</a></div>` : ''}
    <div class="bio-footer">Powered by OkLeaf</div>
  </div>
</body>
</html>`;

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(html);
  } catch (err) {
    log('error', 'bio.public.render error', { error: String(err) });
    return res.status(500).send('Internal server error');
  }
}

export async function getPublicBioPageJson(req: Request, res: Response) {
  try {
    const slug = normalizeSlug(req.params?.slug);
    if (!slug) return res.status(404).json({ success: false, error: 'Not found' });
    const { rows } = await db.query(
      `SELECT id, slug, title, description, avatar_url, theme, cta_label, cta_url, is_active
         FROM bio_pages
        WHERE slug = $1 AND is_active = true
        LIMIT 1`,
      [slug]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    const page = rows[0];
    const links = await db.query(
      `SELECT id, label, url, icon, sort_order, is_active, click_count
         FROM bio_links
        WHERE page_id = $1 AND is_active = true
        ORDER BY sort_order ASC, created_at ASC`,
      [page.id]
    );
    return res.json({ success: true, data: { ...page, links: links.rows } });
  } catch (err) {
    log('error', 'bio.public.json error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function redirectBioLink(req: Request, res: Response) {
  try {
    const slug = normalizeSlug(req.params?.slug);
    const linkId = String(req.params?.linkId || '');
    if (!slug || !linkId) return res.status(404).send('Not found');

    const { rows } = await db.query(
      `SELECT bl.id, bl.url
         FROM bio_links bl
         JOIN bio_pages bp ON bp.id = bl.page_id
        WHERE bp.slug = $1 AND bl.id = $2 AND bp.is_active = true AND bl.is_active = true
        LIMIT 1`,
      [slug, linkId]
    );
    const link = rows[0];
    if (!link?.url) return res.status(404).send('Not found');

    await db.query(`UPDATE bio_links SET click_count = click_count + 1 WHERE id = $1`, [linkId]);
    return res.redirect(302, link.url);
  } catch (err) {
    log('error', 'bio.public.redirect error', { error: String(err) });
    return res.status(500).send('Internal server error');
  }
}

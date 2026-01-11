// src/controllers/redirect.controller.ts
import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import bcrypt from 'bcrypt';
import UAParser from 'ua-parser-js';
import db from '../config/database';
import redisClient from '../config/redis';
import { lookupGeo } from '../services/geoip';
import { enqueueClick } from '../services/clickQueue';
import { getCachedLink, setCachedLink } from '../services/linkCache';
import { anonymizeIp } from '../utils/ip';

function nowUtc(): Date { return new Date(); }
function safeRedirectUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

const PW_COOKIE_TTL_SECONDS = 60 * 60 * 24;
const DEEP_LINK_TIMEOUT_MS = 1500;

function normalizeHost(raw?: string | null): string {
  const input = String(raw || '').trim().toLowerCase();
  if (!input) return '';
  let host = input;
  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      host = new URL(input).host;
    } catch {
      host = input;
    }
  }
  return host.replace(/:\d+$/, '');
}

const CORE_HOSTS = new Set(
  [process.env.CORE_DOMAIN, process.env.PUBLIC_HOST, process.env.BASE_URL]
    .map((val) => normalizeHost(val))
    .filter(Boolean)
);
const ALLOW_ANY_CORE_HOST = CORE_HOSTS.size === 0;

function getRequestHost(req: Request): string {
  const forwarded = String(req.headers['x-forwarded-host'] || '').split(',')[0]?.trim();
  const host = forwarded || req.get('host') || req.hostname || '';
  return normalizeHost(host);
}

function cookieSecret(): string {
  return process.env.PW_COOKIE_SECRET || process.env.JWT_SECRET || 'pw-secret';
}

function base64Url(input: Buffer) {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function signCookie(linkId: string, expiresAt: number) {
  const payload = `${linkId}.${expiresAt}`;
  const sig = base64Url(createHmac('sha256', cookieSecret()).update(payload).digest());
  return `${expiresAt}.${sig}`;
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie || '';
  const out: Record<string, string> = {};
  header.split(';').forEach((part) => {
    const [k, ...rest] = part.trim().split('=');
    if (!k) return;
    out[k] = rest.join('=');
  });
  return out;
}

function cookieName(linkId: string) {
  return `okleaf_pw_${linkId}`;
}

function hasValidPwCookie(req: Request, linkId: string): boolean {
  const cookies = parseCookies(req);
  const value = cookies[cookieName(linkId)];
  if (!value) return false;
  const [expStr, sig] = value.split('.');
  if (!expStr || !sig) return false;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expected = signCookie(linkId, expiresAt).split('.')[1];
  if (!expected) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function setPwCookie(res: Response, linkId: string) {
  const expiresAt = Date.now() + PW_COOKIE_TTL_SECONDS * 1000;
  const value = signCookie(linkId, expiresAt);
  res.setHeader('Set-Cookie', `${cookieName(linkId)}=${value}; Max-Age=${PW_COOKIE_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax`);
}

function renderPasswordPrompt(res: Response, shortCode: string, error = false) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const message = error ? 'Invalid password. Try again.' : 'This link is password protected.';
  return res.status(401).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Protected link</title>
    <style>
      body{font-family:Arial,sans-serif;background:#0b0d10;color:#f5f1e8;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}
      .card{background:#151c26;border:1px solid #2a2f3a;border-radius:16px;padding:28px;max-width:360px;width:90%}
      h1{font-size:20px;margin:0 0 12px}
      p{color:#b8b3a9;font-size:14px;margin:0 0 18px}
      input{width:100%;padding:12px;border-radius:12px;border:1px solid #2a2f3a;background:#0f141b;color:#f5f1e8}
      button{margin-top:14px;width:100%;padding:12px;border-radius:999px;border:0;background:#e0b15a;color:#141414;font-weight:600;cursor:pointer}
    </style>
  </head>
  <body>
    <form class="card" method="post" action="/${shortCode}">
      <h1>Protected link</h1>
      <p>${message}</p>
      <input type="password" name="password" placeholder="Enter password" required />
      <button type="submit">Continue</button>
    </form>
  </body>
</html>`);
}

function pickVariant(variants: Array<{ url: string; weight: number; active: boolean }> | undefined, fallback: string) {
  const active = (variants || []).filter((v) => v.active !== false);
  if (!active.length) return fallback;
  const total = active.reduce((sum, v) => sum + Math.max(1, Number(v.weight) || 1), 0);
  let roll = Math.random() * total;
  for (const v of active) {
    roll -= Math.max(1, Number(v.weight) || 1);
    if (roll <= 0) return v.url;
  }
  return active[0].url;
}

function userAgentPlatform(ua: string) {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}

function deviceTypeFromUa(ua: string) {
  const parser = new UAParser(ua);
  const type = parser.getDevice().type || 'desktop';
  return String(type).toLowerCase();
}

function parseRouteValues(value: string | null | undefined): string[] {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function pickRoutedDestination(params: {
  routes: Array<{ rule_type: string; rule_value: string; destination_url: string; priority: number; active: boolean }>;
  geoCountry?: string | null;
  deviceType?: string;
  platform?: string;
}): string | null {
  const { routes, geoCountry, deviceType, platform } = params;
  for (const route of routes) {
    if (route.active === false) continue;
    const values = parseRouteValues(route.rule_value);
    if (!values.length) continue;
    if (route.rule_type === 'country') {
      if (geoCountry && values.includes(geoCountry.toLowerCase())) return route.destination_url;
      continue;
    }
    if (route.rule_type === 'device') {
      if (deviceType && values.includes(deviceType)) return route.destination_url;
      continue;
    }
    if (route.rule_type === 'platform') {
      if (platform && values.includes(platform)) return route.destination_url;
      continue;
    }
  }
  return null;
}

function renderDeepLinkPage(res: Response, params: {
  deepLinkUrl: string;
  fallbackUrl: string;
  shortCode: string;
}) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const { deepLinkUrl, fallbackUrl, shortCode } = params;
  return res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Opening app…</title>
    <style>
      body{font-family:Arial,sans-serif;background:#0b0d10;color:#f5f1e8;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}
      .card{background:#151c26;border:1px solid #2a2f3a;border-radius:16px;padding:28px;max-width:420px;width:90%}
      h1{font-size:20px;margin:0 0 12px}
      p{color:#b8b3a9;font-size:14px;margin:0 0 14px}
      a{color:#e0b15a;text-decoration:none}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Opening your app…</h1>
      <p>If nothing happens, <a href="${fallbackUrl}">continue to the web link</a>.</p>
      <p class="muted">Short code: ${shortCode}</p>
    </div>
    <script>
      const deepLink = ${JSON.stringify(deepLinkUrl)};
      const fallback = ${JSON.stringify(fallbackUrl)};
      const start = Date.now();
      window.location.href = deepLink;
      setTimeout(() => {
        if (Date.now() - start < ${DEEP_LINK_TIMEOUT_MS} + 500) {
          window.location.href = fallback;
        }
      }, ${DEEP_LINK_TIMEOUT_MS});
    </script>
  </body>
</html>`);
}

export class RedirectController {
  public redirect = async (req: Request, res: Response) => {
    try {
      const { shortCode } = req.params;

      let link = await getCachedLink(shortCode);
      if (link && typeof link.domain === 'undefined') {
        link = null;
      }
      if (!link) {
        const q = `
          SELECT l.id, l.original_url, l.expires_at, l.active, l.org_id, o.ip_anonymization, l.password_hash,
                 l.deep_link_url, l.ios_fallback_url, l.android_fallback_url, l.deep_link_enabled,
                 d.domain AS domain
            FROM links l
            JOIN orgs o ON o.id = l.org_id
            LEFT JOIN domains d ON d.id = l.domain_id
           WHERE short_code = $1
           LIMIT 1
        `;
        const { rows } = await db.query(q, [shortCode]);
        if (!rows.length) return res.status(404).send('Not found');
        const { rows: variants } = await db.query(
          `SELECT url, weight, active
             FROM link_variants
            WHERE link_id = $1 AND active = true
            ORDER BY created_at ASC`,
          [rows[0].id]
        );
        const { rows: routes } = await db.query(
          `SELECT rule_type, rule_value, destination_url, priority, active
             FROM link_routes
            WHERE link_id = $1 AND active = true
            ORDER BY priority ASC, created_at ASC`,
          [rows[0].id]
        );
        link = {
          id: rows[0].id,
          original_url: rows[0].original_url,
          domain: rows[0].domain || null,
          expires_at: rows[0].expires_at,
          active: rows[0].active !== false,
          org_id: rows[0].org_id,
          ip_anonymization: rows[0].ip_anonymization === true,
          password_hash: rows[0].password_hash || null,
          deep_link_url: rows[0].deep_link_url || null,
          ios_fallback_url: rows[0].ios_fallback_url || null,
          android_fallback_url: rows[0].android_fallback_url || null,
          deep_link_enabled: rows[0].deep_link_enabled === true,
          variants: variants || [],
          routes: routes || [],
        };
        void setCachedLink(shortCode, link);
      }

      const requestHost = getRequestHost(req);
      if (requestHost) {
        const linkDomain = normalizeHost(link.domain || '');
        if (linkDomain) {
          if (requestHost !== linkDomain) {
            return res.status(404).send('Not found');
          }
        } else if (!ALLOW_ANY_CORE_HOST && !CORE_HOSTS.has(requestHost)) {
          return res.status(404).send('Not found');
        }
      }

      if (link.active === false) {
        return res.status(410).send('Link is paused');
      }
      if (link.expires_at && new Date(link.expires_at) <= nowUtc()) {
        return res.status(410).send('Link expired');
      }

      if (link.password_hash) {
        if (!hasValidPwCookie(req, link.id)) {
          const provided = String((req.body as any)?.password || req.query?.pw || '').trim();
          if (!provided) return renderPasswordPrompt(res, shortCode);
          const ok = await bcrypt.compare(provided, link.password_hash);
          if (!ok) return renderPasswordPrompt(res, shortCode, true);
          setPwCookie(res, link.id);
        }
      }

      // Best-effort analytics: bump click_count and log click_events
      const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
      const ip = link.ip_anonymization ? anonymizeIp(rawIp) : rawIp;
      const referer = (req.get('referer') || null);
      const ua = (req.get('user-agent') || null);
      const routes = Array.isArray(link.routes) ? link.routes : [];
      const needsGeo = routes.some((r) => r.rule_type === 'country');
      const routingGeo = needsGeo ? await lookupGeo(rawIp) : null;
      const routedUrl = routes.length
        ? pickRoutedDestination({
          routes,
          geoCountry: routingGeo?.country_code ?? null,
          deviceType: deviceTypeFromUa(String(ua || '')),
          platform: userAgentPlatform(String(ua || '')),
        })
        : null;

      const fallbackDirect = async () => {
        const geo = (!link.ip_anonymization && routingGeo && rawIp === ip) ? routingGeo : await lookupGeo(ip);
        void db.query(`UPDATE links SET click_count = COALESCE(click_count,0) + 1 WHERE id = $1`, [link?.id]);
        void db.query(
          `INSERT INTO click_events (link_id, ip, referer, user_agent, country_code, country_name, region, city, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            link?.id,
            ip,
            referer,
            ua,
            geo?.country_code ?? null,
            geo?.country_name ?? null,
            geo?.region ?? null,
            geo?.city ?? null,
            geo?.latitude ?? null,
            geo?.longitude ?? null,
          ]
        ).catch(() => {});
      };

      if (redisClient.isReady) {
        void enqueueClick({
          link_id: link.id,
          ip,
          referer,
          user_agent: ua,
        }).catch(() => fallbackDirect());
      } else {
        void fallbackDirect();
      }

      const destination = routedUrl || pickVariant(link.variants, link.original_url);
      const safeUrl = safeRedirectUrl(destination);
      if (!safeUrl) return res.status(400).send('Invalid destination');
      if (link.deep_link_enabled && link.deep_link_url) {
        const ua = String(req.headers['user-agent'] || '');
        const platform = userAgentPlatform(ua);
        if (platform !== 'other') {
          const fallbackUrl = platform === 'ios'
            ? (link.ios_fallback_url || safeUrl)
            : (link.android_fallback_url || safeUrl);
          return renderDeepLinkPage(res, {
            deepLinkUrl: link.deep_link_url,
            fallbackUrl,
            shortCode,
          });
        }
      }
      return res.redirect(302, safeUrl);
    } catch (e) {
      console.error('redirect error:', e);
      return res.status(500).send('Internal server error');
    }
  };
}

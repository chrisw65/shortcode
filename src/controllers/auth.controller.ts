// src/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import db from '../config/database';
import { getEffectivePlan } from '../services/plan';
import { recordConsent } from '../services/consent';
import { getRetentionDefaultDays } from '../services/platformConfig';
import { defaultScopes, discoverIssuer, normalizeIssuer } from '../services/oidc';

// ---- helpers ---------------------------------------------------------------

function safeUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    plan: row.plan ?? null,
    created_at: row.created_at ?? null,
    is_active: row.is_active ?? true,
    email_verified: row.email_verified ?? true,
    is_superadmin: row.is_superadmin ?? false,
  };
}

function signToken(payload: Record<string, any>) {
  const secret: Secret = process.env.JWT_SECRET as Secret;
  if (!secret) throw new Error('JWT_SECRET missing');

  // Infer the exact type jsonwebtoken expects
  const expiresIn: SignOptions['expiresIn'] = (() => {
    const expEnv = process.env.JWT_EXPIRES_IN;
    if (expEnv && /^\d+$/.test(expEnv)) return Number(expEnv); // seconds
    return (expEnv || '7d') as SignOptions['expiresIn'];       // ms-style string like '7d'
  })();

  const opts: SignOptions = { expiresIn };
  return jwt.sign(payload, secret, opts);
}

const APP_URL = process.env.PUBLIC_HOST || process.env.BASE_URL || 'https://okleaf.link';
const OIDC_STATE_COOKIE = 'oidc_state';
const OIDC_STATE_TTL_SECONDS = 600;

type OidcState = {
  org_id: string;
  redirect: string;
  state: string;
  nonce: string;
  code_verifier: string;
  issuer: string;
  client_id: string;
};

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function hashSha256(input: string): string {
  return base64url(createHash('sha256').update(input).digest());
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const [k, ...rest] = part.trim().split('=');
    if (!k) return acc;
    acc[k] = decodeURIComponent(rest.join('='));
    return acc;
  }, {} as Record<string, string>);
}

function isSecure(req: Request): boolean {
  if (req.secure) return true;
  const xfwd = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return xfwd.includes('https');
}

function setCookie(res: Response, name: string, value: string, opts: { maxAge?: number; path?: string } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  parts.push(`Path=${opts.path || '/'}`);
  parts.push('HttpOnly');
  parts.push('SameSite=Lax');
  if (isSecure(res.req as Request)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function signOidcState(payload: OidcState): string {
  const secret: Secret = process.env.JWT_SECRET as Secret;
  if (!secret) throw new Error('JWT_SECRET missing');
  return jwt.sign(payload, secret, { expiresIn: OIDC_STATE_TTL_SECONDS });
}

function verifyOidcState(token: string): OidcState {
  const secret: Secret = process.env.JWT_SECRET as Secret;
  if (!secret) throw new Error('JWT_SECRET missing');
  return jwt.verify(token, secret) as OidcState;
}

function sanitizeRedirect(input?: string): string {
  if (!input) return '/admin/dashboard.html';
  if (input.startsWith('/')) return input;
  try {
    const base = new URL(APP_URL);
    const url = new URL(input, base);
    if (url.origin === base.origin) {
      return url.pathname + url.search + url.hash;
    }
  } catch {}
  return '/admin/dashboard.html';
}

async function loginImpl(req: Request, res: Response) {
  try {
    const rawEmail = String(req.body?.email ?? '');
    const rawPass = String(req.body?.password ?? '');
    const email = rawEmail.replace(/\s+/g, '').trim().toLowerCase();

    if (!email || !rawPass) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const { rows } = await db.query(
      `SELECT id, email, name, plan, created_at, password AS password_hash,
              COALESCE(is_active, true)  AS is_active,
              COALESCE(email_verified, true) AS email_verified,
              COALESCE(is_superadmin, false) AS is_superadmin
         FROM users
        WHERE LOWER(email) = $1
        LIMIT 1`,
      [email]
    );

    const user = rows[0];
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    if (user.is_active === false) {
      return res.status(403).json({ success: false, error: 'Account disabled' });
    }

    const { rows: policyRows } = await db.query(
      `SELECT 1
         FROM org_memberships m
         JOIN org_policies p ON p.org_id = m.org_id
        WHERE m.user_id = $1 AND p.require_sso = true
        LIMIT 1`,
      [user.id]
    );
    if (policyRows.length) {
      return res.status(403).json({ success: false, error: 'SSO is required for your organization' });
    }

    // compare, with a guard for accidental leading/trailing spaces
    let ok = await bcrypt.compare(rawPass, user.password_hash);
    if (!ok && (/^\s/.test(rawPass) || /\s$/.test(rawPass))) {
      const trimmed = rawPass.trim();
      if (trimmed.length > 0) ok = await bcrypt.compare(trimmed, user.password_hash);
    }
    if (!ok) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const token = signToken({ userId: user.id, email: user.email, is_superadmin: user.is_superadmin });
    return res.json({ success: true, data: { user: safeUser(user), token } });
  } catch (err) {
    console.error('auth.login error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function registerImpl(req: Request, res: Response) {
  try {
    const email = String(req.body?.email ?? '').replace(/\s+/g, '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const name = (req.body?.name ?? null) as string | null;
    const inviteToken = String(req.body?.invite_token ?? '');
    const couponCode = String(req.body?.coupon_code ?? '');
    const affiliateCode = String(req.body?.affiliate_code ?? '');
    const termsAccepted = Boolean(req.body?.terms_accepted);
    const termsVersion = String(req.body?.terms_version || process.env.TERMS_VERSION || '2026-01');

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const hash = await bcrypt.hash(password, 12);

    await db.query('BEGIN');

    const { rows } = await db.query(
      `INSERT INTO users (email, password, name, is_active, email_verified, is_superadmin)
       VALUES ($1, $2, $3, true, true, false)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, name, plan, created_at, password AS password_hash, is_active, email_verified, is_superadmin`,
      [email, hash, name]
    );

    const user = rows[0];
    if (!user) {
      await db.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'User already exists' });
    }

    let orgId: string | null = null;

    if (inviteToken) {
      const inviteRes = await db.query(
        `SELECT id, org_id, inviter_user_id, role
           FROM invites
          WHERE token = $1
            AND status = 'sent'
            AND (expires_at IS NULL OR expires_at > NOW())
          LIMIT 1`,
        [inviteToken]
      );
      const invite = inviteRes.rows[0];
      if (!invite) {
        await db.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'Invalid or expired invite' });
      }

      orgId = invite.org_id;
      await db.query(
        `INSERT INTO org_memberships (org_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [invite.org_id, user.id, invite.role]
      );

      await db.query(
        `UPDATE invites
            SET status = 'accepted', accepted_at = NOW()
          WHERE id = $1`,
        [invite.id]
      );

      if (invite.inviter_user_id) {
        await db.query(
          `INSERT INTO referrals (referrer_user_id, invitee_user_id)
           VALUES ($1, $2)`,
          [invite.inviter_user_id, user.id]
        );
      }
    } else {
      const orgName = 'Default Org';
      const retentionDefault = await getRetentionDefaultDays();
      const orgRes = await db.query(
        `INSERT INTO orgs (name, owner_user_id, data_retention_days)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [orgName, user.id, retentionDefault]
      );
      orgId = orgRes.rows[0].id;

      await db.query(
        `INSERT INTO org_memberships (org_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [orgId, user.id]
      );
    }

    if (couponCode) {
      const { rows: couponRows } = await db.query(
        `SELECT *
           FROM coupons
          WHERE code = $1 AND active = true
          LIMIT 1`,
        [couponCode.replace(/\s+/g, '').toUpperCase()]
      );
      const coupon = couponRows[0];
      if (!coupon) {
        await db.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'Invalid coupon' });
      }
      if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
        await db.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'Coupon expired' });
      }

      const { rows: redemptions } = await db.query(
        `SELECT count(*)::int AS count FROM coupon_redemptions WHERE coupon_id = $1`,
        [coupon.id]
      );
      if (coupon.max_redemptions && redemptions[0]?.count >= coupon.max_redemptions) {
        await db.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'Coupon limit reached' });
      }

      await db.query(
        `INSERT INTO coupon_redemptions (coupon_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [coupon.id, user.id]
      );

      await db.query(
        `INSERT INTO plan_grants (target_type, target_id, plan, ends_at, reason, created_by)
         VALUES ('user', $1, $2, NOW() + ($3 || ' months')::interval, $4, $5)`,
        [user.id, coupon.plan, coupon.duration_months, `coupon:${coupon.code}`, user.id]
      );
    }

    if (affiliateCode) {
      const { rows: affRows } = await db.query(
        `SELECT id
           FROM affiliates
          WHERE code = $1 AND status = 'active'
          LIMIT 1`,
        [affiliateCode.replace(/\s+/g, '').toUpperCase()]
      );
      const affiliate = affRows[0];
      if (!affiliate) {
        await db.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'Invalid affiliate code' });
      }
      await db.query(
        `INSERT INTO affiliate_conversions (affiliate_id, user_id, org_id, amount, status)
         VALUES ($1, $2, $3, 0, 'pending')`,
        [affiliate.id, user.id, orgId]
      );
    }

    if (termsAccepted) {
      await recordConsent({
        user_id: user.id,
        consent_type: 'terms',
        version: termsVersion,
        metadata: { source: 'register' },
      });
    }

    await db.query('COMMIT');

    const token = signToken({ userId: user.id, email: user.email, is_superadmin: user.is_superadmin });
    return res.status(201).json({
      success: true,
      data: { user: safeUser(user), token, org_id: orgId },
    });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch {}
    console.error('auth.register error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function meImpl(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { rows } = await db.query(
      `SELECT id, email, name, plan, created_at,
              COALESCE(is_active, true)  AS is_active,
              COALESCE(email_verified, true) AS email_verified,
              COALESCE(is_superadmin, false) AS is_superadmin
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [user.userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });

    const org = (req as any).org ?? null;
    const effectivePlan = await getEffectivePlan(user.userId, org?.orgId);
    return res.json({ success: true, data: { user: safeUser(rows[0]), org, effective_plan: effectivePlan } });
  } catch (err) {
    console.error('auth.me error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function changePasswordImpl(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const current_password = String(req.body?.current_password ?? '');
    const new_password = String(req.body?.new_password ?? '');
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, error: 'current_password and new_password are required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ success: false, error: 'new_password must be at least 8 characters' });
    }

    const { rows } = await db.query(
      `SELECT password AS password_hash FROM users WHERE id = $1 LIMIT 1`,
      [user.userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });

    const ok = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ success: false, error: 'Invalid current password' });

    const newHash = await bcrypt.hash(new_password, 12);
    await db.query(`UPDATE users SET password = $1 WHERE id = $2`, [newHash, user.userId]);

    return res.json({ success: true, data: { updated: true } });
  } catch (err) {
    console.error('auth.changePassword error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function oidcStartImpl(req: Request, res: Response) {
  try {
    const orgId = String(req.query.org_id || '').trim();
    if (!orgId) return res.status(400).json({ success: false, error: 'org_id is required' });
    const redirect = sanitizeRedirect(String(req.query.redirect || ''));

    const { rows } = await db.query(
      `SELECT issuer_url, client_id, client_secret, scopes, enabled
         FROM org_sso
        WHERE org_id = $1
        LIMIT 1`,
      [orgId]
    );
    const sso = rows[0];
    if (!sso || !sso.enabled) {
      return res.status(400).json({ success: false, error: 'SSO is not enabled for this org' });
    }

    const issuer = normalizeIssuer(String(sso.issuer_url || ''));
    const clientId = String(sso.client_id || '').trim();
    const clientSecret = String(sso.client_secret || '').trim();
    if (!issuer || !clientId || !clientSecret) {
      return res.status(400).json({ success: false, error: 'SSO is missing required configuration' });
    }

    const discovery = await discoverIssuer(issuer);
    const state = base64url(randomBytes(16));
    const nonce = base64url(randomBytes(16));
    const codeVerifier = base64url(randomBytes(32));
    const codeChallenge = hashSha256(codeVerifier);
    const redirectUri = `${APP_URL.replace(/\/+$/, '')}/api/auth/oidc/callback`;

    const token = signOidcState({
      org_id: orgId,
      redirect,
      state,
      nonce,
      code_verifier: codeVerifier,
      issuer,
      client_id: clientId,
    });
    setCookie(res, OIDC_STATE_COOKIE, token, { maxAge: OIDC_STATE_TTL_SECONDS, path: '/api/auth/oidc/callback' });

    const authUrl = new URL(discovery.authorization_endpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', defaultScopes(sso.scopes || []).join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return res.redirect(authUrl.toString());
  } catch (err) {
    console.error('auth.oidc.start error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function oidcCallbackImpl(req: Request, res: Response) {
  try {
    const code = String(req.query.code || '').trim();
    const state = String(req.query.state || '').trim();
    if (!code || !state) {
      return res.status(400).json({ success: false, error: 'Missing code or state' });
    }

    const cookies = parseCookies(req);
    const stateToken = cookies[OIDC_STATE_COOKIE];
    if (!stateToken) return res.status(400).json({ success: false, error: 'Missing OIDC state' });
    const payload = verifyOidcState(stateToken);
    if (payload.state !== state) {
      return res.status(400).json({ success: false, error: 'Invalid OIDC state' });
    }

    const redirectPath = sanitizeRedirect(payload.redirect);
    const { rows } = await db.query(
      `SELECT issuer_url, client_id, client_secret, scopes, enabled
         FROM org_sso
        WHERE org_id = $1
        LIMIT 1`,
      [payload.org_id]
    );
    const sso = rows[0];
    if (!sso || !sso.enabled) {
      return res.status(400).json({ success: false, error: 'SSO is not enabled for this org' });
    }

    const issuer = normalizeIssuer(String(sso.issuer_url || ''));
    const discovery = await discoverIssuer(issuer);
    const redirectUri = `${APP_URL.replace(/\/+$/, '')}/api/auth/oidc/callback`;

    const tokenParams = new URLSearchParams();
    tokenParams.set('grant_type', 'authorization_code');
    tokenParams.set('code', code);
    tokenParams.set('redirect_uri', redirectUri);
    tokenParams.set('client_id', String(sso.client_id || ''));
    tokenParams.set('client_secret', String(sso.client_secret || ''));
    tokenParams.set('code_verifier', payload.code_verifier);

    const tokenRes = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });
    if (!tokenRes.ok) {
      return res.status(400).json({ success: false, error: 'Token exchange failed' });
    }
    const tokenJson = await tokenRes.json();
    const idToken = tokenJson.id_token as string | undefined;
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Missing id_token' });
    }

    const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
    const { payload: idPayload } = await jwtVerify(idToken, jwks, {
      issuer: discovery.issuer,
      audience: String(sso.client_id || ''),
    });
    if (idPayload.nonce !== payload.nonce) {
      return res.status(400).json({ success: false, error: 'Invalid OIDC nonce' });
    }

    let email = (idPayload.email as string | undefined) || '';
    let name = (idPayload.name as string | undefined) || (idPayload.preferred_username as string | undefined) || null;

    if (!email && discovery.userinfo_endpoint && tokenJson.access_token) {
      const infoRes = await fetch(discovery.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (infoRes.ok) {
        const info = await infoRes.json();
        email = String(info.email || '');
        name = name || info.name || info.preferred_username || null;
      }
    }

    email = String(email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, error: 'No email claim available' });
    }

    const userRes = await db.query(
      `SELECT id, email, name, is_active, email_verified, is_superadmin
         FROM users
        WHERE LOWER(email) = $1
        LIMIT 1`,
      [email]
    );

    let user = userRes.rows[0];
    if (!user) {
      const randomPass = base64url(randomBytes(24));
      const hash = await bcrypt.hash(randomPass, 12);
      const ins = await db.query(
        `INSERT INTO users (email, password, name, is_active, email_verified, is_superadmin)
         VALUES ($1, $2, $3, true, true, false)
         RETURNING id, email, name, is_active, email_verified, is_superadmin`,
        [email, hash, name]
      );
      user = ins.rows[0];
    }

    if (user?.is_active === false) {
      return res.status(403).json({ success: false, error: 'Account disabled' });
    }

    await db.query(
      `INSERT INTO org_memberships (org_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (org_id, user_id) DO NOTHING`,
      [payload.org_id, user.id]
    );

    const token = signToken({ userId: user.id, email: user.email, is_superadmin: user.is_superadmin });
    setCookie(res, OIDC_STATE_COOKIE, '', { maxAge: 0, path: '/api/auth/oidc/callback' });

    const target = new URL(redirectPath, APP_URL);
    target.hash = `token=${encodeURIComponent(token)}`;
    return res.redirect(target.toString());
  } catch (err) {
    console.error('auth.oidc.callback error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// Class export for existing routes
export class AuthController {
  login = (req: Request, res: Response) => { void loginImpl(req, res); };
  register = (req: Request, res: Response) => { void registerImpl(req, res); };
  me = (req: Request, res: Response) => { void meImpl(req, res); };
  changePassword = (req: Request, res: Response) => { void changePasswordImpl(req, res); };
  oidcStart = (req: Request, res: Response) => { void oidcStartImpl(req, res); };
  oidcCallback = (req: Request, res: Response) => { void oidcCallbackImpl(req, res); };
}

// Named exports (if used elsewhere)
export const login = (req: Request, res: Response) => { void loginImpl(req, res); };
export const register = (req: Request, res: Response) => { void registerImpl(req, res); };
export const me = (req: Request, res: Response) => { void meImpl(req, res); };
export const changePassword = (req: Request, res: Response) => { void changePasswordImpl(req, res); };

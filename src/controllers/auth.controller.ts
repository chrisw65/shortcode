// src/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { generateSecret, generateURI, verify } from 'otplib';
import qrcode from 'qrcode';
import db from '../config/database';
import { getEffectivePlan } from '../services/plan';
import { getPlanEntitlements } from '../services/entitlements';
import { recordConsent } from '../services/consent';
import { getRetentionDefaultDays } from '../services/platformConfig';
import { defaultScopes, discoverIssuer, normalizeIssuer } from '../services/oidc';
import { sendMail, hasSmtpConfig } from '../services/mailer';
import { DEFAULT_SITE_CONFIG, getSiteSetting, mergeConfig } from '../services/siteConfig';
import type { AuthenticatedRequest } from '../middleware/auth';
import type { OrgRequest } from '../middleware/org';
import { log } from '../utils/logger';

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
    two_factor_enabled: row.totp_enabled ?? false,
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

function signChallengeToken(payload: Record<string, any>) {
  const secret: Secret = process.env.JWT_SECRET as Secret;
  if (!secret) throw new Error('JWT_SECRET missing');
  const opts: SignOptions = { expiresIn: '5m' };
  return jwt.sign({ ...payload, type: '2fa' }, secret, opts);
}

function verifyChallengeToken(token: string): jwt.JwtPayload {
  const secret: Secret = process.env.JWT_SECRET as Secret;
  if (!secret) throw new Error('JWT_SECRET missing');
  const payload = jwt.verify(token, secret) as jwt.JwtPayload;
  if (payload?.type !== '2fa') {
    throw new Error('Invalid challenge token');
  }
  return payload;
}

const APP_URL = process.env.PUBLIC_HOST || process.env.BASE_URL || 'https://okleaf.link';
const OIDC_STATE_COOKIE = 'oidc_state';
const AUTH_COOKIE = 'auth_token';
const AUTH_PRESENT_COOKIE = 'auth_present';
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || '30');
const OIDC_STATE_TTL_SECONDS = 600;
const TWO_FA_ISSUER = process.env.TOTP_ISSUER || 'OkLeaf';
const TOTP_EPOCH_TOLERANCE = Number(process.env.TOTP_EPOCH_TOLERANCE || '30');

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

const EMAIL_VERIFY_TTL_HOURS_RAW = Number(process.env.EMAIL_VERIFY_TTL_HOURS || '24');
const PASSWORD_RESET_TTL_MINUTES_RAW = Number(process.env.PASSWORD_RESET_TTL_MINUTES || '60');
const EMAIL_VERIFY_TTL_HOURS = Number.isFinite(EMAIL_VERIFY_TTL_HOURS_RAW) && EMAIL_VERIFY_TTL_HOURS_RAW > 0
  ? EMAIL_VERIFY_TTL_HOURS_RAW
  : 24;
const PASSWORD_RESET_TTL_MINUTES = Number.isFinite(PASSWORD_RESET_TTL_MINUTES_RAW) && PASSWORD_RESET_TTL_MINUTES_RAW > 0
  ? PASSWORD_RESET_TTL_MINUTES_RAW
  : 60;
const EMAIL_VERIFICATION_REQUIRED = process.env.EMAIL_VERIFICATION_REQUIRED === '1';

function buildPublicUrl(path: string) {
  const base = APP_URL.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function renderTemplate(template: string, vars: Record<string, string>) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => (
    key in vars ? vars[key] : match
  ));
}

async function loadSiteConfig(useDraft = false) {
  let stored = await getSiteSetting(useDraft ? 'marketing_draft' : 'marketing_published');
  if (!stored && !useDraft) {
    stored = await getSiteSetting('marketing_draft');
  }
  return mergeConfig(DEFAULT_SITE_CONFIG, stored || {});
}

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

async function createEmailVerificationToken(userId: string) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000);
  await db.query(`DELETE FROM email_verification_tokens WHERE user_id = $1`, [userId]);
  await db.query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
  return token;
}

async function createPasswordResetToken(userId: string) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
  await db.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [userId]);
  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
  return token;
}

async function sendVerificationEmail(to: string, token: string) {
  const config = await loadSiteConfig(false);
  const brandName = config?.brand?.name || 'OkLeaf';
  const supportEmail = config?.footer?.email || 'support@okleaf.link';
  const verifyUrl = buildPublicUrl(`/verify.html?token=${encodeURIComponent(token)}`);
  const vars = { brandName, supportEmail, verifyUrl };
  const subject = renderTemplate(config?.emails?.verify?.subject || 'Verify your email', vars);
  const text = renderTemplate(config?.emails?.verify?.text || '', vars);
  const html = renderTemplate(config?.emails?.verify?.html || '', vars);
  return sendMail({ to, subject, text, html });
}

async function sendPasswordResetEmail(to: string, token: string) {
  const config = await loadSiteConfig(false);
  const brandName = config?.brand?.name || 'OkLeaf';
  const supportEmail = config?.footer?.email || 'support@okleaf.link';
  const resetUrl = buildPublicUrl(`/reset.html?token=${encodeURIComponent(token)}`);
  const vars = { brandName, supportEmail, resetUrl };
  const subject = renderTemplate(config?.emails?.reset?.subject || 'Reset your password', vars);
  const text = renderTemplate(config?.emails?.reset?.text || '', vars);
  const html = renderTemplate(config?.emails?.reset?.html || '', vars);
  return sendMail({ to, subject, text, html });
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

function setCookie(
  res: Response,
  name: string,
  value: string,
  opts: { maxAge?: number; path?: string; httpOnly?: boolean } = {}
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  parts.push('SameSite=Lax');
  if (isSecure(res.req as Request)) parts.push('Secure');
  const cookie = parts.join('; ');
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookie);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookie]);
    return;
  }
  res.setHeader('Set-Cookie', [existing as string, cookie]);
}

function parseExpiresSeconds(): number | null {
  const expEnv = process.env.JWT_EXPIRES_IN;
  if (expEnv && /^\d+$/.test(expEnv)) return Number(expEnv);
  const match = String(expEnv || '7d').match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return value * multiplier;
}

function setAuthCookies(res: Response, token: string) {
  const maxAge = parseExpiresSeconds() ?? undefined;
  setCookie(res, AUTH_COOKIE, token, { maxAge, path: '/', httpOnly: true });
  setCookie(res, AUTH_PRESENT_COOKIE, '1', { maxAge, path: '/', httpOnly: false });
}

function clearAuthCookies(res: Response) {
  setCookie(res, AUTH_COOKIE, '', { maxAge: 0, path: '/', httpOnly: true });
  setCookie(res, AUTH_PRESENT_COOKIE, '', { maxAge: 0, path: '/', httpOnly: false });
}

function refreshExpiresAt() {
  const ttl = Number.isFinite(REFRESH_TOKEN_TTL_DAYS) ? REFRESH_TOKEN_TTL_DAYS : 30;
  return new Date(Date.now() + ttl * 24 * 60 * 60 * 1000);
}

function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  setCookie(res, REFRESH_COOKIE, token, { maxAge, path: '/', httpOnly: true });
}

function clearRefreshCookie(res: Response) {
  setCookie(res, REFRESH_COOKIE, '', { maxAge: 0, path: '/', httpOnly: true });
}

async function issueRefreshToken(userId: string) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = refreshExpiresAt();
  const { rows } = await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, tokenHash, expiresAt]
  );
  return { token, id: rows[0].id, expiresAt };
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
              COALESCE(is_superadmin, false) AS is_superadmin,
              COALESCE(totp_enabled, false) AS totp_enabled,
              totp_secret
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

    if (EMAIL_VERIFICATION_REQUIRED && user.email_verified === false) {
      return res.status(403).json({ success: false, error: 'Email not verified', requires_email_verification: true });
    }

    if (user.totp_enabled && user.totp_secret) {
      const challenge = signChallengeToken({ userId: user.id, email: user.email });
      return res.json({ success: true, data: { requires_2fa: true, challenge_token: challenge } });
    }

    const token = signToken({ userId: user.id, email: user.email, is_superadmin: user.is_superadmin });
    setAuthCookies(res, token);
    const refresh = await issueRefreshToken(user.id);
    setRefreshCookie(res, refresh.token, refresh.expiresAt);
    return res.json({ success: true, data: { user: safeUser(user) } });
  } catch (err) {
    log('error', 'auth.login.error', { error: String(err) });
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
    const smtpReady = await hasSmtpConfig();
    const needsVerification = smtpReady && EMAIL_VERIFICATION_REQUIRED;
    const emailVerified = !smtpReady;

    await db.query('BEGIN');

    const { rows } = await db.query(
      `INSERT INTO users (email, password, name, is_active, email_verified, is_superadmin)
       VALUES ($1, $2, $3, true, $4, false)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, name, plan, created_at, password AS password_hash, is_active, email_verified, is_superadmin`,
      [email, hash, name, emailVerified]
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

    let verificationSent = false;
    if (smtpReady) {
      try {
        const verifyToken = await createEmailVerificationToken(user.id);
        const result = await sendVerificationEmail(user.email, verifyToken);
        verificationSent = result.sent === true;
      } catch (err) {
        log('error', 'auth.register.verify_email.error', { error: String(err) });
      }
    }

    const token = needsVerification ? null : signToken({ userId: user.id, email: user.email, is_superadmin: user.is_superadmin });
    if (token) {
      setAuthCookies(res, token);
      const refresh = await issueRefreshToken(user.id);
      setRefreshCookie(res, refresh.token, refresh.expiresAt);
    }
    return res.status(201).json({
      success: true,
      data: {
        user: safeUser(user),
        org_id: orgId,
        verification_sent: verificationSent,
        requires_email_verification: needsVerification,
      },
    });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (rbErr) { log('warn', 'auth.register.rollback_failed', { error: String(rbErr) }); }
    log('error', 'auth.register.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function meImpl(req: OrgRequest, res: Response) {
  try {
    const user = req.user;
    if (!user?.userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { rows } = await db.query(
      `SELECT id, email, name, plan, created_at,
              COALESCE(is_active, true)  AS is_active,
              COALESCE(email_verified, true) AS email_verified,
              COALESCE(is_superadmin, false) AS is_superadmin,
              COALESCE(totp_enabled, false) AS totp_enabled
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [user.userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });

    const org = req.org ?? null;
    const effectivePlan = await getEffectivePlan(user.userId, org?.orgId);
    const entitlements = await getPlanEntitlements(effectivePlan);
    return res.json({ success: true, data: { user: safeUser(rows[0]), org, effective_plan: effectivePlan, entitlements } });
  } catch (err) {
    log('error', 'auth.me.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function changePasswordImpl(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
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
    log('error', 'auth.changePassword.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function verifyEmailImpl(req: Request, res: Response) {
  try {
    const token = String(req.body?.token || req.query?.token || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, error: 'token is required' });
    }
    const tokenHash = hashToken(token);
    const { rows } = await db.query(
      `SELECT user_id, expires_at, consumed_at
         FROM email_verification_tokens
        WHERE token_hash = $1
        LIMIT 1`,
      [tokenHash]
    );
    if (!rows.length) {
      return res.status(400).json({ success: false, error: 'Invalid or expired token' });
    }
    const row = rows[0];
    if (row.consumed_at || (row.expires_at && new Date(row.expires_at) <= new Date())) {
      return res.status(400).json({ success: false, error: 'Invalid or expired token' });
    }

    await db.query('BEGIN');
    await db.query(`UPDATE users SET email_verified = true WHERE id = $1`, [row.user_id]);
    await db.query(`UPDATE email_verification_tokens SET consumed_at = NOW() WHERE token_hash = $1`, [tokenHash]);
    await db.query(
      `DELETE FROM email_verification_tokens WHERE user_id = $1 AND token_hash <> $2`,
      [row.user_id, tokenHash]
    );
    await db.query('COMMIT');

    return res.json({ success: true });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (rbErr) { log('warn', 'auth.verifyEmail.rollback_failed', { error: String(rbErr) }); }
    log('error', 'auth.verifyEmail.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function resendVerificationImpl(req: Request, res: Response) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, error: 'email is required' });
    }
    const smtpReady = await hasSmtpConfig();
    if (!smtpReady) {
      return res.status(400).json({ success: false, error: 'Email service not configured' });
    }
    const { rows } = await db.query(
      `SELECT id, email_verified FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );
    if (!rows.length) {
      return res.json({ success: true, data: { sent: true } });
    }
    if (rows[0].email_verified) {
      return res.json({ success: true, data: { sent: true } });
    }

    const verifyToken = await createEmailVerificationToken(rows[0].id);
    const result = await sendVerificationEmail(email, verifyToken);
    if (!result.sent) {
      return res.status(400).json({ success: false, error: result.reason || 'Email not sent' });
    }
    return res.json({ success: true, data: { sent: true } });
  } catch (err) {
    log('error', 'auth.resendVerification.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function requestPasswordResetImpl(req: Request, res: Response) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, error: 'email is required' });
    }
    const smtpReady = await hasSmtpConfig();
    if (!smtpReady) {
      return res.status(400).json({ success: false, error: 'Email service not configured' });
    }

    const { rows } = await db.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );
    if (rows.length) {
      const resetToken = await createPasswordResetToken(rows[0].id);
      const result = await sendPasswordResetEmail(email, resetToken);
      if (!result.sent) {
        return res.status(400).json({ success: false, error: result.reason || 'Email not sent' });
      }
    }

    return res.json({ success: true });
  } catch (err) {
    log('error', 'auth.requestPasswordReset.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function resetPasswordImpl(req: Request, res: Response) {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.password || '').trim();
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'token and password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'password must be at least 8 characters' });
    }

    const tokenHash = hashToken(token);
    const { rows } = await db.query(
      `SELECT user_id, expires_at, consumed_at
         FROM password_reset_tokens
        WHERE token_hash = $1
        LIMIT 1`,
      [tokenHash]
    );
    if (!rows.length) {
      return res.status(400).json({ success: false, error: 'Invalid or expired token' });
    }
    const row = rows[0];
    if (row.consumed_at || (row.expires_at && new Date(row.expires_at) <= new Date())) {
      return res.status(400).json({ success: false, error: 'Invalid or expired token' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('BEGIN');
    await db.query(`UPDATE users SET password = $1 WHERE id = $2`, [hash, row.user_id]);
    await db.query(`UPDATE password_reset_tokens SET consumed_at = NOW() WHERE token_hash = $1`, [tokenHash]);
    await db.query(
      `DELETE FROM password_reset_tokens WHERE user_id = $1 AND token_hash <> $2`,
      [row.user_id, tokenHash]
    );
    await db.query('COMMIT');

    return res.json({ success: true });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (rbErr) { log('warn', 'auth.resetPassword.rollback_failed', { error: String(rbErr) }); }
    log('error', 'auth.resetPassword.error', { error: String(err) });
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
    log('error', 'auth.oidc.start.error', { error: String(err) });
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
      `SELECT issuer_url, client_id, client_secret, scopes, enabled, auto_provision, default_role, allowed_domains
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
    const emailDomain = email.split('@')[1] || '';
    const allowedDomains = Array.isArray(sso.allowed_domains) ? sso.allowed_domains : [];
    if (allowedDomains.length && (!emailDomain || !allowedDomains.includes(emailDomain))) {
      return res.status(403).json({ success: false, error: 'Email domain is not allowed for this organization' });
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
      if (sso.auto_provision === false) {
        return res.status(403).json({ success: false, error: 'User provisioning is disabled for this organization' });
      }
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

    const role = ['owner', 'admin', 'member'].includes(String(sso.default_role || '').toLowerCase())
      ? String(sso.default_role).toLowerCase()
      : 'member';
    await db.query(
      `INSERT INTO org_memberships (org_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (org_id, user_id) DO NOTHING`,
      [payload.org_id, user.id, role]
    );

    const token = signToken({ userId: user.id, email: user.email, is_superadmin: user.is_superadmin });
    setCookie(res, OIDC_STATE_COOKIE, '', { maxAge: 0, path: '/api/auth/oidc/callback' });
    setAuthCookies(res, token);
    const refresh = await issueRefreshToken(user.id);
    setRefreshCookie(res, refresh.token, refresh.expiresAt);

    const target = new URL(redirectPath, APP_URL);
    return res.redirect(target.toString());
  } catch (err) {
    log('error', 'auth.oidc.callback.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function twoFactorSetupImpl(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user?.userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { rows } = await db.query(
      `SELECT email, totp_enabled FROM users WHERE id = $1 LIMIT 1`,
      [user.userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });
    if (rows[0].totp_enabled) {
      return res.status(400).json({ success: false, error: 'Two-factor authentication already enabled' });
    }

    const secret = generateSecret();
    await db.query(
      `UPDATE users
          SET totp_secret = $1,
              totp_enabled = false,
              totp_verified_at = NULL
        WHERE id = $2`,
      [secret, user.userId]
    );

    const email = String(rows[0].email || '').trim();
    const otpauth = generateURI({ issuer: TWO_FA_ISSUER, label: email, secret });
    const qrDataUrl = await qrcode.toDataURL(otpauth);

    return res.json({ success: true, data: { secret, otpauth_url: otpauth, qr_data_url: qrDataUrl } });
  } catch (err) {
    log('error', 'auth.2fa.setup.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function twoFactorVerifyImpl(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user?.userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const code = String(req.body?.code || '').trim();
    if (!code) return res.status(400).json({ success: false, error: 'code is required' });

    const { rows } = await db.query(
      `SELECT totp_secret FROM users WHERE id = $1 LIMIT 1`,
      [user.userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });
    const secret = rows[0].totp_secret;
    if (!secret) return res.status(400).json({ success: false, error: 'Two-factor setup not initialized' });

    const result = await verify({ secret, token: code, epochTolerance: TOTP_EPOCH_TOLERANCE });
    if (!result.valid) return res.status(400).json({ success: false, error: 'Invalid code' });

    await db.query(
      `UPDATE users
          SET totp_enabled = true,
              totp_verified_at = NOW(),
              totp_last_used = NOW()
        WHERE id = $1`,
      [user.userId]
    );
    return res.json({ success: true, data: { enabled: true } });
  } catch (err) {
    log('error', 'auth.2fa.verify.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function twoFactorDisableImpl(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user?.userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const current_password = String(req.body?.current_password ?? '');
    const code = String(req.body?.code ?? '').trim();
    if (!current_password || !code) {
      return res.status(400).json({ success: false, error: 'current_password and code are required' });
    }

    const { rows } = await db.query(
      `SELECT password AS password_hash, totp_secret, totp_enabled
         FROM users WHERE id = $1 LIMIT 1`,
      [user.userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });
    if (!rows[0].totp_enabled || !rows[0].totp_secret) {
      return res.status(400).json({ success: false, error: 'Two-factor authentication is not enabled' });
    }

    const ok = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ success: false, error: 'Invalid current password' });
    const verifyResult = await verify({
      secret: rows[0].totp_secret,
      token: code,
      epochTolerance: TOTP_EPOCH_TOLERANCE,
    });
    if (!verifyResult.valid) {
      return res.status(400).json({ success: false, error: 'Invalid code' });
    }

    await db.query(
      `UPDATE users
          SET totp_enabled = false,
              totp_secret = NULL,
              totp_verified_at = NULL,
              totp_last_used = NULL
        WHERE id = $1`,
      [user.userId]
    );
    return res.json({ success: true, data: { enabled: false } });
  } catch (err) {
    log('error', 'auth.2fa.disable.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function twoFactorConfirmImpl(req: Request, res: Response) {
  try {
    const challengeToken = String(req.body?.challenge_token || '').trim();
    const code = String(req.body?.code || '').trim();
    if (!challengeToken || !code) {
      return res.status(400).json({ success: false, error: 'challenge_token and code are required' });
    }

    const payload = verifyChallengeToken(challengeToken);
    const userId = String(payload.userId || '');
    if (!userId) return res.status(401).json({ success: false, error: 'Invalid challenge token' });

    const { rows } = await db.query(
      `SELECT id, email, is_active, is_superadmin, totp_secret, totp_enabled
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });
    const userRow = rows[0];
    if (userRow.is_active === false) {
      return res.status(403).json({ success: false, error: 'Account disabled' });
    }
    if (!userRow.totp_enabled || !userRow.totp_secret) {
      return res.status(400).json({ success: false, error: 'Two-factor authentication not enabled' });
    }

    const verifyResult = await verify({
      secret: userRow.totp_secret,
      token: code,
      epochTolerance: TOTP_EPOCH_TOLERANCE,
    });
    if (!verifyResult.valid) return res.status(400).json({ success: false, error: 'Invalid code' });

    await db.query(`UPDATE users SET totp_last_used = NOW() WHERE id = $1`, [userRow.id]);
    const token = signToken({ userId: userRow.id, email: userRow.email, is_superadmin: userRow.is_superadmin });
    setAuthCookies(res, token);
    const refresh = await issueRefreshToken(userRow.id);
    setRefreshCookie(res, refresh.token, refresh.expiresAt);
    return res.json({ success: true });
  } catch (err) {
    log('error', 'auth.2fa.confirm.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function createSessionImpl(req: Request, res: Response) {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, error: 'token is required' });
    }
    const secret: Secret = process.env.JWT_SECRET as Secret;
    if (!secret) return res.status(500).json({ success: false, error: 'Server misconfigured: JWT_SECRET missing' });
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    if (payload?.type === '2fa') {
      return res.status(400).json({ success: false, error: 'Invalid session token' });
    }
    const userId = String(payload.userId || '');
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Invalid session token' });
    }
    const { rows } = await db.query(
      `SELECT id, is_active
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });
    if (rows[0].is_active === false) {
      return res.status(403).json({ success: false, error: 'Account disabled' });
    }
    setAuthCookies(res, token);
    const refresh = await issueRefreshToken(userId);
    setRefreshCookie(res, refresh.token, refresh.expiresAt);
    return res.json({ success: true });
  } catch (err) {
    log('error', 'auth.session.error', { error: String(err) });
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

async function refreshImpl(req: Request, res: Response) {
  try {
    const cookies = parseCookies(req);
    const refreshToken = cookies[REFRESH_COOKIE];
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Missing refresh token' });
    }
    const tokenHash = hashToken(refreshToken);
    await db.query('BEGIN');
    const { rows } = await db.query(
      `SELECT r.id, r.user_id, r.expires_at, r.revoked_at,
              u.email, u.is_superadmin, u.is_active
         FROM refresh_tokens r
         JOIN users u ON u.id = r.user_id
        WHERE r.token_hash = $1
        LIMIT 1
        FOR UPDATE`,
      [tokenHash]
    );
    if (!rows.length) {
      await db.query('ROLLBACK');
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }
    const record = rows[0];
    if (record.revoked_at || new Date(record.expires_at) <= new Date()) {
      await db.query('ROLLBACK');
      return res.status(401).json({ success: false, error: 'Refresh token expired' });
    }
    if (record.is_active === false) {
      await db.query('ROLLBACK');
      return res.status(403).json({ success: false, error: 'Account disabled' });
    }

    const newToken = randomBytes(32).toString('hex');
    const newHash = hashToken(newToken);
    const newExpires = refreshExpiresAt();
    const insert = await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [record.user_id, newHash, newExpires]
    );
    await db.query(
      `UPDATE refresh_tokens
          SET revoked_at = NOW(),
              replaced_by = $2
        WHERE id = $1`,
      [record.id, insert.rows[0].id]
    );
    await db.query('COMMIT');

    const token = signToken({ userId: record.user_id, email: record.email, is_superadmin: record.is_superadmin });
    setAuthCookies(res, token);
    setRefreshCookie(res, newToken, newExpires);
    return res.json({ success: true });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (rbErr) { log('warn', 'auth.refresh.rollback_failed', { error: String(rbErr) }); }
    log('error', 'auth.refresh.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function logoutImpl(req: Request, res: Response) {
  clearAuthCookies(res);
  clearRefreshCookie(res);
  const cookies = parseCookies(req);
  const refreshToken = cookies[REFRESH_COOKIE];
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await db.query(
      `UPDATE refresh_tokens
          SET revoked_at = NOW()
        WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );
  }
  return res.json({ success: true });
}

// Class export for existing routes
export class AuthController {
  login = (req: Request, res: Response) => { void loginImpl(req, res); };
  register = (req: Request, res: Response) => { void registerImpl(req, res); };
  me = (req: Request, res: Response) => { void meImpl(req, res); };
  changePassword = (req: Request, res: Response) => { void changePasswordImpl(req, res); };
  verifyEmail = (req: Request, res: Response) => { void verifyEmailImpl(req, res); };
  resendVerification = (req: Request, res: Response) => { void resendVerificationImpl(req, res); };
  requestPasswordReset = (req: Request, res: Response) => { void requestPasswordResetImpl(req, res); };
  resetPassword = (req: Request, res: Response) => { void resetPasswordImpl(req, res); };
  oidcStart = (req: Request, res: Response) => { void oidcStartImpl(req, res); };
  oidcCallback = (req: Request, res: Response) => { void oidcCallbackImpl(req, res); };
  createSession = (req: Request, res: Response) => { void createSessionImpl(req, res); };
  refresh = (req: Request, res: Response) => { void refreshImpl(req, res); };
  logout = (req: Request, res: Response) => { void logoutImpl(req, res); };
  twoFactorSetup = (req: Request, res: Response) => { void twoFactorSetupImpl(req, res); };
  twoFactorVerify = (req: Request, res: Response) => { void twoFactorVerifyImpl(req, res); };
  twoFactorDisable = (req: Request, res: Response) => { void twoFactorDisableImpl(req, res); };
  twoFactorConfirm = (req: Request, res: Response) => { void twoFactorConfirmImpl(req, res); };
}

// Named exports (if used elsewhere)
export const login = (req: Request, res: Response) => { void loginImpl(req, res); };
export const register = (req: Request, res: Response) => { void registerImpl(req, res); };
export const me = (req: Request, res: Response) => { void meImpl(req, res); };
export const changePassword = (req: Request, res: Response) => { void changePasswordImpl(req, res); };
export const verifyEmail = (req: Request, res: Response) => { void verifyEmailImpl(req, res); };
export const resendVerification = (req: Request, res: Response) => { void resendVerificationImpl(req, res); };
export const requestPasswordReset = (req: Request, res: Response) => { void requestPasswordResetImpl(req, res); };
export const resetPassword = (req: Request, res: Response) => { void resetPasswordImpl(req, res); };
export const createSession = (req: Request, res: Response) => { void createSessionImpl(req, res); };
export const refresh = (req: Request, res: Response) => { void refreshImpl(req, res); };
export const logout = (req: Request, res: Response) => { void logoutImpl(req, res); };
export const twoFactorSetup = (req: Request, res: Response) => { void twoFactorSetupImpl(req, res); };
export const twoFactorVerify = (req: Request, res: Response) => { void twoFactorVerifyImpl(req, res); };
export const twoFactorDisable = (req: Request, res: Response) => { void twoFactorDisableImpl(req, res); };
export const twoFactorConfirm = (req: Request, res: Response) => { void twoFactorConfirmImpl(req, res); };

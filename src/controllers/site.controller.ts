// src/controllers/site.controller.ts
import type { Request, Response } from 'express';
import db from '../config/database';
import redisClient from '../config/redis';
import { DEFAULT_SITE_CONFIG, getSiteSetting, mergeConfig } from '../services/siteConfig';
import { sendMail } from '../services/mailer';
import type { AuthenticatedRequest } from '../middleware/auth';
import { log } from '../utils/logger';

const SITE_PUBLIC_CACHE_KEY = 'site:public-config';

async function getCachedPublicConfig() {
  if (!redisClient.isReady) return null;
  try {
    const raw = await redisClient.get(SITE_PUBLIC_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function setCachedPublicConfig(config: any) {
  if (!redisClient.isReady) return;
  try {
    await redisClient.set(SITE_PUBLIC_CACHE_KEY, JSON.stringify(config), { EX: 300 });
  } catch {
    // best-effort
  }
}

async function invalidatePublicConfigCache() {
  if (!redisClient.isReady) return;
  try { await redisClient.del(SITE_PUBLIC_CACHE_KEY); } catch {}
}

async function insertHistory(action: string, value: any, userId?: string | null) {
  await db.query(
    `INSERT INTO site_settings_history (key, value, user_id, action)
     VALUES ($1, $2::jsonb, $3, $4)`,
    ['marketing', JSON.stringify(value), userId || null, action]
  );
}

export async function getPublicSiteConfig(req: Request, res: Response) {
  try {
    res.set('Cache-Control', 'no-store, must-revalidate');
    const cached = await getCachedPublicConfig();
    if (cached) return res.json({ success: true, data: cached });
    const published = await getSiteSetting('marketing_published');
    const draft = await getSiteSetting('marketing_draft');
    const base = published || draft || {};
    const config = mergeConfig(DEFAULT_SITE_CONFIG, base);
    const safe = sanitizePublicConfig(config);
    await setCachedPublicConfig(safe);
    return res.json({ success: true, data: safe });
  } catch (err) {
    log('error', 'site.getPublicSiteConfig.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function getAdminSiteConfig(_req: AuthenticatedRequest, res: Response) {
  try {
    const draftRaw = await getSiteSetting('marketing_draft');
    const publishedRaw = await getSiteSetting('marketing_published');
    const draft = mergeConfig(DEFAULT_SITE_CONFIG, draftRaw || {});
    const published = publishedRaw ? mergeConfig(DEFAULT_SITE_CONFIG, publishedRaw) : null;
    return res.json({ success: true, data: { draft, published } });
  } catch (err) {
    log('error', 'site.getAdminSiteConfig.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateSiteConfig(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId ?? null;
    const payload = req.body ?? null;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    await db.query(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      ['marketing_draft', JSON.stringify(payload)]
    );

    await insertHistory('draft_saved', payload, userId);
    await invalidatePublicConfigCache();
    return res.json({ success: true, data: payload });
  } catch (err) {
    log('error', 'site.updateSiteConfig.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function publishSiteConfig(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId ?? null;
    const draft = await getSiteSetting('marketing_draft') || DEFAULT_SITE_CONFIG;
    await db.query(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      ['marketing_published', JSON.stringify(draft)]
    );

    await insertHistory('published', draft, userId);
    await invalidatePublicConfigCache();
    return res.json({ success: true, data: draft });
  } catch (err) {
    log('error', 'site.publishSiteConfig.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function getSiteHistory(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      `SELECT h.id, h.action, h.created_at, h.value, u.email AS user_email
       FROM site_settings_history h
       LEFT JOIN users u ON u.id = h.user_id
       WHERE h.key = $1
       ORDER BY h.created_at DESC
       LIMIT 25`,
      ['marketing']
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'site.getSiteHistory.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function rollbackSiteConfig(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId ?? null;
    const historyId = String(req.body?.history_id || '');
    if (!historyId) {
      return res.status(400).json({ success: false, error: 'history_id is required' });
    }

    const { rows } = await db.query(
      `SELECT value FROM site_settings_history WHERE id = $1 LIMIT 1`,
      [historyId]
    );
    const value = rows[0]?.value;
    if (!value) {
      return res.status(404).json({ success: false, error: 'History entry not found' });
    }

    await db.query(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      ['marketing_draft', JSON.stringify(value)]
    );

    await insertHistory('rollback', value, userId);
    await invalidatePublicConfigCache();
    return res.json({ success: true, data: value });
  } catch (err) {
    log('error', 'site.rollbackSiteConfig.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

const APP_URL = process.env.PUBLIC_HOST || process.env.BASE_URL || 'https://okleaf.link';

function renderTemplate(template: string, vars: Record<string, string>) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => (
    key in vars ? vars[key] : match
  ));
}

export async function sendSiteEmailTest(req: AuthenticatedRequest, res: Response) {
  try {
    const to = String(req.body?.to || '').trim();
    if (!to) {
      return res.status(400).json({ success: false, error: 'to is required' });
    }
    const template = req.body?.template || {};
    const draftRaw = await getSiteSetting('marketing_draft');
    const draft = mergeConfig(DEFAULT_SITE_CONFIG, draftRaw || {});
    const brandName = draft?.brand?.name || 'OkLeaf';
    const supportEmail = draft?.footer?.email || 'support@okleaf.link';
    const inviter = req.user?.email || 'Admin';
    const inviteUrl = `${APP_URL}/register.html?invite=example`;

    const vars = { brandName, supportEmail, inviter, inviteUrl };
    const subject = renderTemplate(
      template.subject || draft?.emails?.invite?.subject || 'You are invited to {{brandName}}',
      vars
    );
    const text = renderTemplate(
      template.text || draft?.emails?.invite?.text || '',
      vars
    );
    const html = renderTemplate(
      template.html || draft?.emails?.invite?.html || '',
      vars
    );

    const result = await sendMail({ to, subject, text, html }, { useDraft: true });
    if (!result.sent) {
      return res.status(400).json({ success: false, error: result.reason || 'Email not sent' });
    }

    return res.json({ success: true });
  } catch (err) {
    log('error', 'site.sendSiteEmailTest.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function sendContactMessage(req: Request, res: Response) {
  try {
    const name = String(req.body?.name || '').trim();
    const company = String(req.body?.company || '').trim();
    const org = String(req.body?.org || '').trim();
    const email = String(req.body?.email || '').trim();
    const message = String(req.body?.message || '').trim();
    const website = String(req.body?.website || '').trim();
    const captchaAnswer = String(req.body?.captchaAnswer || '').trim();
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'name, email, and message are required' });
    }

    const published = await getSiteSetting('marketing_published');
    const config = mergeConfig(DEFAULT_SITE_CONFIG, published || {});
    const contact = config.pages?.contact || {};
    const to = contact.supportEmail || config.footer?.email || 'support@okleaf.link';
    const subject = contact.formSubject || 'New contact request';
    const successMessage = contact.formSuccess || 'Thanks! We will get back to you within 1 business day.';
    const captcha = contact.captcha || {};
    const captchaExpected = String(captcha.answer || contact.captchaAnswer || '').trim();
    const captchaProvider = String(captcha.provider || contact.captchaProvider || 'simple').trim();
    const captchaSecret = String(captcha.secret || contact.captchaSecret || '').trim();
    const captchaToken = String(req.body?.captchaToken || '').trim();

    if (website) {
      return res.json({ success: true, message: successMessage });
    }
    if (captchaProvider === 'turnstile') {
      if (!captchaSecret) {
        return res.status(400).json({ success: false, error: 'Captcha not configured' });
      }
      if (!captchaToken) {
        return res.status(400).json({ success: false, error: 'Captcha verification failed' });
      }
      const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: captchaSecret,
          response: captchaToken,
          remoteip: (req.headers['cf-connecting-ip'] as string | undefined) || req.ip || '',
        }).toString(),
      });
      const verifyData: any = await verify.json().catch(() => ({}));
      if (!verify.ok || !verifyData?.success) {
        return res.status(400).json({ success: false, error: 'Captcha verification failed' });
      }
    } else if (captchaProvider === 'simple') {
      if (captchaExpected && captchaAnswer !== captchaExpected) {
        return res.status(400).json({ success: false, error: 'Captcha verification failed' });
      }
    }

    const text = [
      `Name: ${name}`,
      `Company: ${company || '-'}`,
      `Existing org: ${org || '-'}`,
      `Email: ${email}`,
      '',
      message,
    ].join('\n');

    const html = [
      '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">',
      `<p><strong>Name:</strong> ${name}</p>`,
      `<p><strong>Company:</strong> ${company || '-'}</p>`,
      `<p><strong>Existing org:</strong> ${org || '-'}</p>`,
      `<p><strong>Email:</strong> ${email}</p>`,
      `<p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>`,
      '</div>',
    ].join('');

    const result = await sendMail({ to, subject, text, html });
    if (!result.sent) {
      return res.status(400).json({ success: false, error: result.reason || 'Email not sent' });
    }

    return res.json({ success: true, message: successMessage });
  } catch (err) {
    log('error', 'site.sendContactMessage.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

function sanitizePublicConfig(config: any) {
  const safe = JSON.parse(JSON.stringify(config || {}));
  if (safe?.pages?.contact?.captcha?.secret) {
    delete safe.pages.contact.captcha.secret;
  }
  if (safe?.pages?.contact?.captchaSecret) {
    delete safe.pages.contact.captchaSecret;
  }
  if (safe?.smtp) {
    delete safe.smtp;
  }
  return safe;
}

export { DEFAULT_SITE_CONFIG };

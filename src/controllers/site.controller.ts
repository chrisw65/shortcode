// src/controllers/site.controller.ts
import type { Request, Response } from 'express';
import db from '../config/database';

const DEFAULT_SITE_CONFIG = {
  brand: {
    name: 'OkLeaf',
    tagline: 'Short links for serious teams.',
  },
  hero: {
    headline: 'Short links that feel enterprise-grade from day one.',
    subheadline: 'Create branded short links, unlock org-wide analytics, and stay in control of every domain you own.',
    primaryCta: { label: 'Start free', href: '/register.html' },
    secondaryCta: { label: 'Book a demo', href: '/contact.html' },
  },
  stats: [
    { label: 'Links created', value: '2.6M+' },
    { label: 'Teams onboarded', value: '1,200+' },
    { label: 'Avg. uptime', value: '99.99%' },
  ],
  features: [
    { title: 'Branded domains', text: 'Launch campaigns on custom domains with verified redirects and org-level control.' },
    { title: 'Analytics you can act on', text: 'Track clicks, devices, referrers, and geo trends by domain and team.' },
    { title: 'Access at scale', text: 'Invite teams, assign roles, and manage API keys with audit trails.' },
    { title: 'Performance built-in', text: 'Fast redirects, global cache, and resilient infrastructure.' },
  ],
  pricing: {
    currency: 'USD',
    billingNote: 'Save 20% with annual billing.',
    tiers: [
      {
        id: 'starter',
        name: 'Starter',
        priceMonthly: 0,
        priceAnnual: 0,
        badge: 'Free',
        highlight: false,
        ctaLabel: 'Start free',
        ctaHref: '/register.html',
        features: [
          '1 branded domain',
          'Up to 1,000 links',
          'Basic analytics',
          'Community support',
        ],
      },
      {
        id: 'pro',
        name: 'Pro',
        priceMonthly: 24,
        priceAnnual: 19,
        badge: 'Most popular',
        highlight: true,
        ctaLabel: 'Upgrade to Pro',
        ctaHref: '/register.html',
        features: [
          '5 branded domains',
          'Unlimited links',
          'Team access (up to 10)',
          'Advanced analytics',
          'Webhook exports',
        ],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        priceMonthly: null,
        priceAnnual: null,
        badge: 'Custom',
        highlight: false,
        ctaLabel: 'Talk to sales',
        ctaHref: '/contact.html',
        features: [
          'Unlimited domains',
          'Unlimited team members',
          'SLA + priority support',
          'Dedicated success lead',
          'Custom data retention',
        ],
      },
    ],
  },
  faqs: [
    {
      q: 'Can I bring my own domain?',
      a: 'Yes. Verify any domain you own and route traffic through OkLeaf with full analytics.',
    },
    {
      q: 'Do you support teams and roles?',
      a: 'Owners can add admins or members and create org-specific API keys with audit logs.',
    },
    {
      q: 'Is there an API?',
      a: 'Yes. Use API keys to automate link creation, management, and analytics exports.',
    },
  ],
  footer: {
    company: 'OkLeaf',
    email: 'support@okleaf.link',
    address: 'Amsterdam • Remote-first',
  },
};

async function getSiteConfig(key: string) {
  try {
    const { rows } = await db.query(`SELECT value FROM site_settings WHERE key = $1 LIMIT 1`, [key]);
    return rows[0]?.value ?? null;
  } catch (err: any) {
    if (err?.code === '42P01') {
      return null;
    }
    throw err;
  }
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
    const published = await getSiteConfig('marketing_published');
    const draft = await getSiteConfig('marketing_draft');
    const config = published || draft || DEFAULT_SITE_CONFIG;
    return res.json({ success: true, data: config });
  } catch (err) {
    console.error('site.getPublicSiteConfig error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function getAdminSiteConfig(req: Request, res: Response) {
  try {
    const draft = await getSiteConfig('marketing_draft') || DEFAULT_SITE_CONFIG;
    const published = await getSiteConfig('marketing_published');
    return res.json({ success: true, data: { draft, published } });
  } catch (err) {
    console.error('site.getAdminSiteConfig error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateSiteConfig(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId ?? null;
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
    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error('site.updateSiteConfig error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function publishSiteConfig(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId ?? null;
    const draft = await getSiteConfig('marketing_draft') || DEFAULT_SITE_CONFIG;
    await db.query(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      ['marketing_published', JSON.stringify(draft)]
    );

    await insertHistory('published', draft, userId);
    return res.json({ success: true, data: draft });
  } catch (err) {
    console.error('site.publishSiteConfig error:', err);
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
    console.error('site.getSiteHistory error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function rollbackSiteConfig(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId ?? null;
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
    return res.json({ success: true, data: value });
  } catch (err) {
    console.error('site.rollbackSiteConfig error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export { DEFAULT_SITE_CONFIG };

// src/services/siteConfig.ts
import db from '../config/database';

export const DEFAULT_SITE_CONFIG = {
  brand: {
    name: 'OkLeaf',
    tagline: 'Short links for serious teams.',
    logoUrl: '',
    logoAlt: 'OkLeaf',
  },
  theme: {
    bg: '#0b0d10',
    bg2: '#0f141b',
    surface: '#151c26',
    text: '#f5f1e8',
    muted: '#b8b3a9',
    accent: '#e0b15a',
    accent2: '#2fb7b2',
    line: '#2a2f3a',
  },
  meta: {
    title: 'OkLeaf - Enterprise-grade URL shortener',
    description: 'Enterprise-grade short links with branded domains, analytics, and team governance.',
    ogTitle: 'OkLeaf - Enterprise-grade URL shortener',
    ogDescription: 'Branded short links, org analytics, and team control in one platform.',
    ogImage: '/favicon.ico',
  },
  nav: {
    links: [
      { label: 'Features', href: '/features.html' },
      { label: 'Pricing', href: '/pricing.html' },
      { label: 'Docs', href: '/docs.html' },
      { label: 'Case studies', href: '/case-studies.html' },
      { label: 'Affiliates', href: '/affiliate/index.html' },
      { label: 'About', href: '/about.html' },
      { label: 'Contact', href: '/contact.html' },
    ],
    ctas: {
      primary: { label: 'Start free', href: '/register.html' },
      secondary: { label: 'Login', href: '/login.html' },
    },
  },
  hero: {
    headline: 'Short links that feel enterprise-grade from day one.',
    subheadline: 'Create branded short links, unlock org-wide analytics, and stay in control of every domain you own.',
    primaryCta: { label: 'Start free', href: '/register.html' },
    secondaryCta: { label: 'Book a demo', href: '/contact.html' },
  },
  logos: [
    { label: 'Oakleaf Ventures' },
    { label: 'Nordic Growth Lab' },
    { label: 'SignalWave Media' },
    { label: 'Bluefin Digital' },
  ],
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
        id: 'free',
        name: 'Free',
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
    links: [
      { label: 'Privacy', href: '/docs.html' },
      { label: 'Terms', href: '/docs.html' },
      { label: 'Status', href: '/docs.html' },
    ],
    social: [
      { label: 'LinkedIn', href: 'https://linkedin.com' },
      { label: 'Twitter', href: 'https://x.com' },
    ],
  },
  emails: {
    invite: {
      subject: 'You are invited to {{brandName}}',
      text: [
        '{{inviter}} invited you to join {{brandName}}.',
        '',
        'Join here: {{inviteUrl}}',
        '',
        'Need help? Contact {{supportEmail}}.',
      ].join('\n'),
      html: [
        '<h2>You are invited to {{brandName}}</h2>',
        '<p>{{inviter}} invited you to join {{brandName}}.</p>',
        '<p><a href="{{inviteUrl}}">Accept your invite</a></p>',
        '<p>If the button doesn\'t work, copy this link:<br>{{inviteUrl}}</p>',
        '<p>Need help? Contact {{supportEmail}}.</p>',
      ].join(''),
    },
  },
  ui: {
    adminTheme: 'noir',
    affiliateTheme: 'noir',
  },
};

export async function getSiteSetting(key: string) {
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

export async function getPublishedSiteConfig() {
  const published = await getSiteSetting('marketing_published');
  return mergeConfig(DEFAULT_SITE_CONFIG, published || {});
}

export function mergeConfig(base: any, override: any) {
  if (!override || typeof override !== 'object') return base;
  if (Array.isArray(base)) {
    return Array.isArray(override) && override.length ? override : base;
  }
  const merged: any = { ...base };
  Object.keys(override).forEach((key) => {
    const baseVal = (base as any)[key];
    const overrideVal = override[key];
    if (baseVal && typeof baseVal === 'object' && !Array.isArray(baseVal)) {
      merged[key] = mergeConfig(baseVal, overrideVal);
    } else if (Array.isArray(baseVal)) {
      merged[key] = Array.isArray(overrideVal) && overrideVal.length ? overrideVal : baseVal;
    } else {
      merged[key] = overrideVal ?? baseVal;
    }
  });
  return merged;
}

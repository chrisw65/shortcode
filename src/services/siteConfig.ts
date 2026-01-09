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
        'Hi,',
        '',
        '{{inviter}} invited you to join {{brandName}}.',
        'Accept the invite to access your workspace:',
        '{{inviteUrl}}',
        '',
        'If you have questions, contact {{supportEmail}}.',
      ].join('\n'),
      html: [
        '<div style="background:#f5f7fb;padding:32px 12px;font-family:Arial,sans-serif;color:#0f172a;">',
        '  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">',
        '    <tr>',
        '      <td style="padding:24px 28px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#ffffff;">',
        '        <div style="font-size:18px;font-weight:600;letter-spacing:0.3px;">{{brandName}}</div>',
        '        <div style="opacity:0.7;font-size:13px;margin-top:4px;">Enterprise link management</div>',
        '      </td>',
        '    </tr>',
        '    <tr>',
        '      <td style="padding:28px;">',
        '        <h2 style="margin:0 0 12px;font-size:22px;color:#0f172a;">You are invited</h2>',
        '        <p style="margin:0 0 16px;line-height:1.6;color:#334155;">{{inviter}} invited you to join {{brandName}}.</p>',
        '        <p style="margin:0 0 18px;line-height:1.6;color:#334155;">Use the button below to accept your invite and get started.</p>',
        '        <div style="margin:20px 0;">',
        '          <a href="{{inviteUrl}}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;border-radius:999px;text-decoration:none;font-weight:600;">Accept invite</a>',
        '        </div>',
        '        <div style="font-size:13px;color:#64748b;">If the button doesn\'t work, copy this link:</div>',
        '        <div style="font-size:13px;color:#2563eb;word-break:break-all;">{{inviteUrl}}</div>',
        '      </td>',
        '    </tr>',
        '    <tr>',
        '      <td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">',
        '        Need help? Contact <a href="mailto:{{supportEmail}}" style="color:#2563eb;text-decoration:none;">{{supportEmail}}</a>',
        '      </td>',
        '    </tr>',
        '  </table>',
        '</div>',
      ].join(''),
    },
  },
  pages: {
    contact: {
      title: "Let's talk about your org",
      subtitle: "Tell us about your current link workflows and we'll tailor a plan that fits your scale.",
      supportEmail: 'support@okleaf.link',
      formSubject: 'New contact request from OkLeaf',
      formSubmitLabel: 'Send message',
      formSuccess: 'Thanks! We will get back to you within 1 business day.',
      captcha: {
        provider: 'simple',
        question: 'What is 3 + 4?',
        answer: '7',
        siteKey: '',
        secret: '',
        theme: 'dark',
      },
      meta: {
        title: 'OkLeaf - Contact',
        description: 'Contact OkLeaf for enterprise plans, demos, and support.',
        ogTitle: 'Contact OkLeaf',
        ogDescription: 'Get in touch with OkLeaf sales or support.',
        ogImage: '/favicon.ico',
      },
    },
    about: {
      title: 'Built for teams who care about brand control',
      subtitle: 'OkLeaf blends fast redirects with enterprise-grade governance so every campaign stays on brand.',
      body: [
        'OkLeaf helps teams launch short links quickly without sacrificing governance.',
        'From domain verification to analytics depth, we focus on clarity, speed, and control.',
      ],
      cards: [
        { title: 'Reliable at scale', text: 'High-performance redirects with caching and resilient infrastructure.' },
        { title: 'Insightful analytics', text: 'Actionable insights across domains, teams, and campaigns.' },
        { title: 'Built for teams', text: 'Role-based access, audit trails, and clear ownership.' },
      ],
      meta: {
        title: 'OkLeaf - About',
        description: 'OkLeaf builds enterprise-grade URL shorteners with brand control and analytics.',
        ogTitle: 'About OkLeaf',
        ogDescription: 'Learn why OkLeaf exists and how it supports enterprise-grade short links.',
        ogImage: '/favicon.ico',
      },
    },
    caseStudies: {
      title: 'Case studies',
      subtitle: 'How teams use OkLeaf to launch campaigns with control.',
      cards: [
        { title: 'Oakleaf Ventures', text: 'Reduced link chaos with domain governance and real-time analytics.' },
        { title: 'SignalWave Media', text: 'Improved campaign performance by tracking channel ROI in minutes.' },
        { title: 'Bluefin Digital', text: 'Unified branded domains across global campaigns.' },
      ],
      meta: {
        title: 'OkLeaf - Case Studies',
        description: 'Case studies from teams using OkLeaf to manage branded links and analytics.',
        ogTitle: 'OkLeaf Case Studies',
        ogDescription: 'See how teams use OkLeaf to standardize link operations and analytics.',
        ogImage: '/favicon.ico',
      },
    },
    useCases: {
      title: 'Use cases',
      subtitle: 'Common workflows teams power with OkLeaf.',
      cards: [
        { title: 'Campaign launches', text: 'Coordinate teams around a single short-link hub.' },
        { title: 'Sales enablement', text: 'Track link performance by persona and region.' },
        { title: 'Customer success', text: 'Give every team a branded domain with clear analytics.' },
      ],
      meta: {
        title: 'OkLeaf - Use Cases',
        description: 'Use cases for teams using OkLeaf to manage branded links and analytics.',
        ogTitle: 'OkLeaf Use Cases',
        ogDescription: 'See common ways teams use OkLeaf to launch and track campaigns.',
        ogImage: '/favicon.ico',
      },
    },
  },
  ui: {
    adminTheme: 'noir',
    affiliateTheme: 'noir',
    adminThemeTokens: {},
    affiliateThemeTokens: {},
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

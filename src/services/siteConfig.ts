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
    headings: {
      support: 'Support',
      company: 'Company',
      social: 'Social',
    },
    links: [
      { label: 'Privacy', href: '/docs.html' },
      { label: 'Terms', href: '/docs.html' },
      { label: 'Status', href: '/docs.html' },
    ],
    social: [
      { label: 'LinkedIn', href: 'https://linkedin.com', icon: 'linkedin' },
      { label: 'X', href: 'https://x.com', icon: 'x' },
    ],
  },
  emails: {
    invite: {
      subject: 'You are invited to {{brandName}}',
      text: [
        'Hello,',
        '',
        '{{inviter}} invited you to join {{brandName}}.',
        'Use this link to accept the invite:',
        '{{inviteUrl}}',
        '',
        'If you were not expecting this invite, you can ignore this email.',
        'Need help? Contact {{supportEmail}}.',
      ].join('\n'),
      html: [
        '<div style="background:#edf2f7;padding:32px 12px;font-family:Helvetica,Arial,sans-serif;color:#0f172a;">',
        '  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 12px 30px rgba(15,23,42,0.08);">',
        '    <tr>',
        '      <td style="padding:28px 32px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#ffffff;">',
        '        <div style="font-size:20px;font-weight:700;letter-spacing:0.3px;">{{brandName}}</div>',
        '        <div style="opacity:0.8;font-size:13px;margin-top:6px;letter-spacing:0.2px;">Invitation to collaborate</div>',
        '      </td>',
        '    </tr>',
        '    <tr>',
        '      <td style="padding:32px;">',
        '        <h2 style="margin:0 0 12px;font-size:22px;color:#0f172a;">You are invited</h2>',
        '        <p style="margin:0 0 16px;line-height:1.7;color:#334155;">{{inviter}} invited you to join {{brandName}}. Accept the invite to access your workspace, manage links, and view analytics.</p>',
        '        <div style="margin:22px 0;">',
        '          <a href="{{inviteUrl}}" style="display:inline-block;padding:12px 22px;background:#2563eb;color:#ffffff;border-radius:999px;text-decoration:none;font-weight:600;">Accept invite</a>',
        '        </div>',
        '        <div style="font-size:13px;color:#64748b;margin-top:12px;">If the button doesn\'t work, copy this link:</div>',
        '        <div style="font-size:13px;color:#2563eb;word-break:break-all;">{{inviteUrl}}</div>',
        '        <div style="margin-top:18px;padding:12px 14px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;font-size:13px;color:#475569;">',
        '          This invite is unique to you. If you were not expecting it, you can ignore this email.',
        '        </div>',
        '      </td>',
        '    </tr>',
        '    <tr>',
        '      <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">',
        '        Need help? Contact <a href="mailto:{{supportEmail}}" style="color:#2563eb;text-decoration:none;">{{supportEmail}}</a>.',
        '      </td>',
        '    </tr>',
        '  </table>',
        '</div>',
      ].join(''),
    },
  },
  pages: {
    home: {
      hero: {
        headline: 'Enterprise short links with brand control baked in.',
        subheadline: 'Govern domains, launch campaigns, and see every click with crystal-clear analytics and team-grade permissions.',
        primaryCta: { label: 'Start free', href: '/register.html' },
        secondaryCta: { label: 'Book a demo', href: '/contact.html' },
      },
      homeCard: {
        title: 'Campaign control, at a glance',
        tag: 'Realtime',
        line: 'okleaf.link/launch - 48,201 clicks - 62% mobile - 3.4% CTR',
        metrics: [
          { label: 'Top region', value: 'Netherlands' },
          { label: 'Best referrer', value: 'LinkedIn' },
          { label: 'Active domains', value: '5' },
          { label: 'Team seats', value: '12' },
        ],
      },
    },
    features: {
      title: 'The modern link stack for fast-moving teams',
      subtitle: 'From branded links to org-level analytics, OkLeaf keeps every campaign in a single system.',
      section: {
        title: 'Built for teams, not just individuals',
        subtitle: 'Invite teammates, assign roles, and audit every change so leadership stays informed.',
      },
      cards: [
        { title: 'Org-level governance', text: 'Owners can approve domains, revoke access, and align teams to shared analytics.' },
        { title: 'API-first workflows', text: 'Automate link creation, enforce naming, and wire campaigns into your stack.' },
        { title: 'Enterprise controls', text: 'Custom retention, SSO-ready patterns, and audit logs built into every plan.' },
        { title: 'Reliable redirects', text: 'Fast, secure redirects with rate controls and monitoring baked in.' },
      ],
      meta: {
        title: 'OkLeaf - Features',
        description: 'Branded domains, API access, analytics, and team governance built into OkLeaf.',
        ogTitle: 'OkLeaf Features',
        ogDescription: 'Explore OkLeaf features for branded short links and analytics.',
        ogImage: '/favicon.ico',
      },
    },
    pricing: {
      title: 'Plans built for every stage of growth',
      subtitle: 'Pick the tier that matches your org. Upgrade anytime as you add domains or teammates.',
      pricing: {
        monthlyLabel: 'Monthly',
        annualLabel: 'Annual',
        faqTitle: 'Frequently asked questions',
        faqSubtitle: 'Answers about billing, upgrades, and enterprise plans.',
      },
      meta: {
        title: 'OkLeaf - Pricing',
        description: 'Compare pricing for OkLeaf plans and pick the tier that fits your team.',
        ogTitle: 'OkLeaf Pricing',
        ogDescription: 'Choose the right OkLeaf plan for your org.',
        ogImage: '/favicon.ico',
      },
    },
    docs: {
      title: 'Documentation',
      subtitle: 'Quick-start guides and API references to help your team launch faster.',
      html: [
        '<div class="doc-grid">',
        '  <div class="doc-card">',
        '    <h3>Getting started</h3>',
        '    <p>Authenticate, create your first branded link, and invite your team.</p>',
        '  </div>',
        '  <div class="doc-card">',
        '    <h3>Domain verification</h3>',
        '    <p>Verify a custom domain, set TXT records, and make it the default.</p>',
        '  </div>',
        '  <div class="doc-card">',
        '    <h3>API usage</h3>',
        '    <p>Use API keys to automate link creation and fetch analytics.</p>',
        '  </div>',
        '  <div class="doc-card">',
        '    <h3>Analytics exports</h3>',
        '    <p>Export click data, filter by domain, and share weekly reports.</p>',
        '  </div>',
        '</div>',
        '<section class="section reveal">',
        '  <h2 class="section-title">Authentication</h2>',
        '  <p class="section-sub">Create an API key in the admin panel and pass it as a Bearer token.</p>',
        '  <pre class="code-block"><code>curl -X GET https://okleaf.link/api/links \\',
        '  -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;"</code></pre>',
        '</section>',
        '<section class="section reveal">',
        '  <h2 class="section-title">Create a short link</h2>',
        '  <p class="section-sub">Send the long URL and optional title or custom code.</p>',
        '  <pre class="code-block"><code>curl -X POST https://okleaf.link/api/links \\',
        '  -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;" \\',
        '  -H "Content-Type: application/json" \\',
        '  -d \'{\"original_url\":\"https://example.com/launch\",\"title\":\"Launch\"}\'</code></pre>',
        '</section>',
        '<section class="section reveal">',
        '  <h2 class="section-title">Analytics summary</h2>',
        '  <p class="section-sub">Pull clicks and referrers for a specific link.</p>',
        '  <pre class="code-block"><code>curl -X GET https://okleaf.link/api/analytics/links/&lt;LINK_ID&gt;/summary \\',
        '  -H "Authorization: Bearer &lt;YOUR_API_KEY&gt;"</code></pre>',
        '</section>',
        '<section class="section reveal">',
        '  <h2 class="section-title">Helpful endpoints</h2>',
        '  <div class="doc-card">',
        '    <p><strong>POST</strong> /api/links - create a link</p>',
        '    <p><strong>GET</strong> /api/links - list links</p>',
        '    <p><strong>POST</strong> /api/domains - add a domain</p>',
        '    <p><strong>GET</strong> /api/analytics/domains/:id/summary - domain analytics</p>',
        '  </div>',
        '</section>',
        '<section class="section reveal">',
        '  <h2 class="section-title">SDKs</h2>',
        '  <p class="section-sub">Use the OkLeaf SDKs to wrap authentication and requests.</p>',
        '  <div class="doc-grid">',
        '    <div class="doc-card">',
        '      <h3>JavaScript / TypeScript</h3>',
        '      <p>Install <strong>@okleaf/sdk</strong> and create links with typed clients.</p>',
        '      <pre class="code-block"><code>npm install @okleaf/sdk',
        '',
        'import { OkLeafClient } from \'@okleaf/sdk\';',
        '',
        'const client = new OkLeafClient({ apiKey: \'YOUR_KEY\' });',
        'await client.links.create({ originalUrl: \'https://example.com\' });</code></pre>',
        '    </div>',
        '    <div class="doc-card">',
        '      <h3>Python</h3>',
        '      <p>Coming soon - join the waitlist for the Python SDK.</p>',
        '      <pre class="code-block"><code># pip install okleaf',
        '# client = OkLeafClient(api_key=\'YOUR_KEY\')</code></pre>',
        '    </div>',
        '  </div>',
        '</section>',
        '<section class="section reveal">',
        '  <h2 class="section-title">Webhooks</h2>',
        '  <p class="section-sub">Push click events to your data warehouse or CRM in realtime.</p>',
        '  <div class="doc-card">',
        '    <p><strong>Event types</strong>: link.created, link.deleted, click.recorded</p>',
        '    <p><strong>Retries</strong>: 5 attempts over 10 minutes</p>',
        '    <p><strong>Signature</strong>: HMAC SHA-256 in <code>X-Okleaf-Signature</code></p>',
        '  </div>',
        '  <pre class="code-block"><code>{',
        '  \"type\": \"click.recorded\",',
        '  \"occurred_at\": \"2026-01-08T17:10:00Z\",',
        '  \"link_id\": \"b14f8a3e-...\",',
        '  \"short_code\": \"launch\",',
        '  \"ip\": \"203.0.113.4\",',
        '  \"referer\": \"https://news.ycombinator.com\"',
        '}</code></pre>',
        '</section>',
      ].join(''),
      meta: {
        title: 'OkLeaf - Docs',
        description: 'OkLeaf documentation for API usage, domain setup, and analytics exports.',
        ogTitle: 'OkLeaf Docs',
        ogDescription: 'API usage, domain verification, and analytics guidance for OkLeaf.',
        ogImage: '/favicon.ico',
      },
    },
    login: {
      title: 'Welcome back',
      subtitle: 'Sign in to manage domains, links, and analytics.',
      bullets: [
        'Track link performance across your org',
        'Manage branded domains and team access',
        'Export analytics and campaign summaries',
      ],
      meta: {
        title: 'OkLeaf - Login',
        description: 'Login to manage your OkLeaf links, domains, and analytics.',
        ogTitle: 'OkLeaf Login',
        ogDescription: 'Access your OkLeaf workspace.',
        ogImage: '/favicon.ico',
      },
    },
    register: {
      title: 'Create your OkLeaf account',
      subtitle: 'Get a branded short link workspace in minutes.',
      bullets: [
        'Set up branded domains in minutes',
        'Invite teammates and assign roles',
        'Unlock analytics and QR exports',
      ],
      meta: {
        title: 'OkLeaf - Start free',
        description: 'Create your OkLeaf account and launch branded short links in minutes.',
        ogTitle: 'Start free with OkLeaf',
        ogDescription: 'Create a new OkLeaf workspace for your team.',
        ogImage: '/favicon.ico',
      },
    },
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

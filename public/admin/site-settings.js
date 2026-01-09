import { requireAuth, apiFetch, showToast, showError } from '/admin/admin-common.js';

requireAuth();

const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = { config: null, history: [], pageKey: 'about', pageDrafts: {}, customThemes: [] };

const THEMES = [
  { id: 'noir', label: 'Noir (default)', accent: '#e0b15a', accent2: '#2fb7b2', bg: '#0b0d10' },
  { id: 'luna', label: 'Luna', accent: '#7fd3ff', accent2: '#4b8bff', bg: '#0b1019' },
  { id: 'sierra', label: 'Sierra', accent: '#ffb359', accent2: '#ff7a59', bg: '#110c08' },
  { id: 'marina', label: 'Marina', accent: '#3dd6b8', accent2: '#49a0ff', bg: '#071217' },
  { id: 'atlas', label: 'Atlas', accent: '#f4b7ff', accent2: '#4fe3c1', bg: '#0c0c18' },
  { id: 'verdant', label: 'Verdant', accent: '#6ee7b7', accent2: '#22c55e', bg: '#0a140f' },
];

const PREMIUM_PRESET = {
  brand: {
    name: 'OkLeaf',
    tagline: 'Short links, enterprise control.',
  },
  hero: {
    headline: 'Enterprise short links with brand control baked in.',
    subheadline: 'Govern domains, launch campaigns, and see every click with crystal-clear analytics and team-grade permissions.',
    primaryCta: { label: 'Start free', href: '/register.html' },
    secondaryCta: { label: 'Talk to sales', href: '/contact.html' },
  },
  stats: [
    { label: 'Links routed', value: '9.4M+' },
    { label: 'Teams onboarded', value: '1,900+' },
    { label: 'Avg. latency', value: '35ms' },
  ],
  features: [
    { title: 'Domain governance', text: 'Verify and manage every branded domain with org-level access policies.' },
    { title: 'Actionable analytics', text: 'Click maps, geo trends, and device insights for every link and campaign.' },
    { title: 'Team collaboration', text: 'Owners, admins, and members with clear permissions and audit trails.' },
    { title: 'Reliability at scale', text: 'Fast redirects backed by caching and resilient infrastructure.' },
  ],
  logos: [
    { label: 'Oakleaf Ventures' },
    { label: 'Northbridge Labs' },
    { label: 'SignalWave Media' },
    { label: 'Bluefin Digital' },
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
        priceMonthly: 29,
        priceAnnual: 24,
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
    { q: 'Can I bring my own domain?', a: 'Yes. Verify any domain you own and route traffic through OkLeaf.' },
    { q: 'Do you support teams and roles?', a: 'Yes. Owners can add admins and members with clear permissions.' },
    { q: 'Is there an API?', a: 'Yes. Automate link creation and analytics exports with API keys.' },
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
};

const PREVIEW_PAGES = [
  { id: 'home', label: 'Home', href: '/index.html' },
  { id: 'features', label: 'Features', href: '/features.html' },
  { id: 'pricing', label: 'Pricing', href: '/pricing.html' },
  { id: 'docs', label: 'Docs', href: '/docs.html' },
  { id: 'about', label: 'About', href: '/about.html' },
  { id: 'contact', label: 'Contact', href: '/contact.html' },
  { id: 'caseStudies', label: 'Case studies', href: '/case-studies.html' },
  { id: 'useCases', label: 'Use cases', href: '/use-cases.html' },
];

function makeInput(label, value, placeholder = '') {
  const wrap = document.createElement('div');
  wrap.className = 'grid';
  wrap.innerHTML = `
    <label class="muted">${label}</label>
    <input class="input" value="${value || ''}" placeholder="${placeholder}">
  `;
  return wrap;
}

function renderStats(stats = []) {
  const list = qs('#statsList');
  list.innerHTML = '';
  stats.forEach((stat) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <label class="muted">Value</label>
      <input class="input" data-field="value" value="${stat.value || ''}">
      <label class="muted" style="margin-top:10px">Label</label>
      <input class="input" data-field="label" value="${stat.label || ''}">
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
}

function renderFeatures(features = []) {
  const list = qs('#featuresList');
  list.innerHTML = '';
  features.forEach((feature) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <label class="muted">Title</label>
      <input class="input" data-field="title" value="${feature.title || ''}">
      <label class="muted" style="margin-top:10px">Text</label>
      <input class="input" data-field="text" value="${feature.text || ''}">
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
}

function renderNavLinks(links = []) {
  const list = qs('#navLinksList');
  list.innerHTML = '';
  links.forEach((link) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <label class="muted">Label</label>
      <input class="input" data-field="label" value="${link.label || ''}">
      <label class="muted" style="margin-top:10px">URL</label>
      <input class="input" data-field="href" value="${link.href || ''}">
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
}

function renderLogos(logos = []) {
  const list = qs('#logosList');
  list.innerHTML = '';
  logos.forEach((logo) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <label class="muted">Label</label>
      <input class="input" data-field="label" value="${logo.label || ''}">
      <label class="muted" style="margin-top:10px">Image URL (optional)</label>
      <input class="input" data-field="imageUrl" value="${logo.imageUrl || ''}">
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
}

function renderFooterLinks(links = []) {
  const list = qs('#footerLinksList');
  list.innerHTML = '';
  links.forEach((link) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <label class="muted">Label</label>
      <input class="input" data-field="label" value="${link.label || ''}">
      <label class="muted" style="margin-top:10px">URL</label>
      <input class="input" data-field="href" value="${link.href || ''}">
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
}

function renderSocialLinks(links = []) {
  const list = qs('#socialLinksList');
  list.innerHTML = '';
  links.forEach((link) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <label class="muted">Label</label>
      <input class="input" data-field="label" value="${link.label || ''}">
      <label class="muted" style="margin-top:10px">URL</label>
      <input class="input" data-field="href" value="${link.href || ''}">
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
}

function renderFaqs(faqs = []) {
  const list = qs('#faqsList');
  list.innerHTML = '';
  faqs.forEach((faq) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <label class="muted">Question</label>
      <input class="input" data-field="q" value="${faq.q || ''}">
      <label class="muted" style="margin-top:10px">Answer</label>
      <input class="input" data-field="a" value="${faq.a || ''}">
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
}

function renderPageCards(cards = []) {
  const list = qs('#pageCardsList');
  list.innerHTML = '';
  cards.forEach((card) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <label class="muted">Title</label>
      <input class="input" data-field="title" value="${card.title || ''}">
      <label class="muted" style="margin-top:10px">Text</label>
      <input class="input" data-field="text" value="${card.text || ''}">
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
}

function renderPageBody(body = []) {
  const list = qs('#pageBodyList');
  list.innerHTML = '';
  body.forEach((paragraph) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <label class="muted">Paragraph</label>
      <textarea class="input" data-field="text" rows="3">${paragraph || ''}</textarea>
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
}

function renderPageFaqs(faqs = []) {
  const list = qs('#pageFaqsList');
  list.innerHTML = '';
  faqs.forEach((faq) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <label class="muted">Question</label>
      <input class="input" data-field="q" value="${faq.q || ''}">
      <label class="muted" style="margin-top:10px">Answer</label>
      <input class="input" data-field="a" value="${faq.a || ''}">
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
}

function renderTiers(tiers = []) {
  const list = qs('#tiersList');
  list.innerHTML = '';
  tiers.forEach((tier) => {
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <div class="row">
        <div style="flex:1">
          <label class="muted">Plan ID (stable)</label>
          <input class="input" data-field="id" value="${tier.id || ''}" placeholder="pro">
        </div>
        <div style="flex:1">
          <label class="muted">Name</label>
          <input class="input" data-field="name" value="${tier.name || ''}">
        </div>
      </div>
      <div class="row">
        <div style="flex:1">
          <label class="muted">Badge</label>
          <input class="input" data-field="badge" value="${tier.badge || ''}">
        </div>
        <div style="flex:1">
          <label class="muted">CTA label</label>
          <input class="input" data-field="ctaLabel" value="${tier.ctaLabel || ''}">
        </div>
      </div>
      <div class="row" style="margin-top:10px">
        <div style="flex:1">
          <label class="muted">Monthly price</label>
          <input class="input" data-field="priceMonthly" value="${tier.priceMonthly ?? ''}" placeholder="24">
        </div>
        <div style="flex:1">
          <label class="muted">Annual price</label>
          <input class="input" data-field="priceAnnual" value="${tier.priceAnnual ?? ''}" placeholder="19">
        </div>
      </div>
      <div class="row" style="margin-top:10px">
        <div style="flex:1">
          <label class="muted">CTA URL</label>
          <input class="input" data-field="ctaHref" value="${tier.ctaHref || ''}">
        </div>
      </div>
      <label class="muted" style="margin-top:10px">Features (one per line)</label>
      <textarea class="input" data-field="features" rows="4">${(tier.features || []).join('\n')}</textarea>
      <label class="row" style="margin-top:10px;gap:8px">
        <input type="checkbox" data-field="highlight" ${tier.highlight ? 'checked' : ''}>
        <span class="muted">Highlight this tier</span>
      </label>
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
}

function renderThemeOptions(selectEl, themes, value) {
  selectEl.innerHTML = themes.map((theme) => (
    `<option value="${theme.id}">${theme.label}</option>`
  )).join('');
  selectEl.value = value || themes[0]?.id || 'noir';
}

function renderThemePicker(container, themes, selected, onSelect) {
  container.innerHTML = themes.map((theme) => (
    `<button type="button" class="theme-card ${theme.id === selected ? 'selected' : ''}" data-theme="${theme.id}">
      <div class="theme-swatch" style="background:${theme.bg}">
        <span style="background:${theme.accent}"></span>
        <span style="background:${theme.accent2}"></span>
      </div>
      <div class="theme-label">${theme.label}</div>
    </button>`
  )).join('');
  container.querySelectorAll('.theme-card').forEach((card) => {
    card.addEventListener('click', () => onSelect(card.dataset.theme));
  });
}

function applyAdminThemePreview(themeId) {
  THEMES.forEach((theme) => document.body.classList.remove(`theme-${theme.id}`));
  if (themeId) document.body.classList.add(`theme-${themeId}`);
}

function mergeDeep(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override : base;
  }
  if (base && typeof base === 'object') {
    const out = { ...base };
    Object.entries(override || {}).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        out[key] = mergeDeep(base[key] || {}, value);
      } else {
        out[key] = value;
      }
    });
    return out;
  }
  return override === undefined ? base : override;
}

function slugify(value) {
  return (value || 'theme')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getAllThemes() {
  return [...THEMES, ...(state.customThemes || [])];
}

function renderPreviewSelect(selectEl, selected) {
  selectEl.innerHTML = PREVIEW_PAGES.map((page) => (
    `<option value="${page.id}">${page.label}</option>`
  )).join('');
  selectEl.value = selected || 'home';
}

function resolvePreviewHref(pageId) {
  const match = PREVIEW_PAGES.find((page) => page.id === pageId) || PREVIEW_PAGES[0];
  return match?.href || '/index.html';
}

function setupAdminPicker(themes) {
  const adminPicker = qs('#adminThemePicker');
  const onSelect = (themeId) => {
    qs('#adminTheme').value = themeId;
    applyAdminThemePreview(themeId);
    const theme = themes.find((t) => t.id === themeId);
    if (theme?.adminTokens) {
      qs('#adminThemeBg').value = theme.adminTokens.bg || '';
      qs('#adminThemePanel').value = theme.adminTokens.panel || '';
      qs('#adminThemeText').value = theme.adminTokens.text || '';
      qs('#adminThemeMuted').value = theme.adminTokens.muted || '';
      qs('#adminThemeAccent').value = theme.adminTokens.accent || '';
      qs('#adminThemeAccent2').value = theme.adminTokens.accent2 || '';
      qs('#adminThemeBorder').value = theme.adminTokens.border || '';
    }
    renderThemePicker(adminPicker, themes, themeId, onSelect);
  };
  renderThemePicker(adminPicker, themes, qs('#adminTheme').value, onSelect);
}

function setupAffiliatePicker(themes) {
  const affiliatePicker = qs('#affiliateThemePicker');
  const onSelect = (themeId) => {
    qs('#affiliateTheme').value = themeId;
    const theme = themes.find((t) => t.id === themeId);
    if (theme?.affiliateTokens) {
      qs('#affiliateThemeBg').value = theme.affiliateTokens.bg || '';
      qs('#affiliateThemeSurface').value = theme.affiliateTokens.surface || '';
      qs('#affiliateThemeText').value = theme.affiliateTokens.text || '';
      qs('#affiliateThemeMuted').value = theme.affiliateTokens.muted || '';
      qs('#affiliateThemeAccent').value = theme.affiliateTokens.accent || '';
      qs('#affiliateThemeAccent2').value = theme.affiliateTokens.accent2 || '';
      qs('#affiliateThemeLine').value = theme.affiliateTokens.line || '';
    }
    renderThemePicker(affiliatePicker, themes, themeId, onSelect);
  };
  renderThemePicker(affiliatePicker, themes, qs('#affiliateTheme').value, onSelect);
}

function readList(container, mapper) {
  return qsa('.card', container).map(mapper).filter(Boolean);
}

function collectConfig() {
  savePageEditor();
  const config = {
    brand: {
      name: qs('#brandName').value.trim(),
      tagline: qs('#brandTagline').value.trim(),
      logoUrl: qs('#brandLogoUrl').value.trim(),
      logoAlt: qs('#brandLogoAlt').value.trim(),
    },
    theme: {
      accent: qs('#themeAccent').value.trim(),
      accent2: qs('#themeAccent2').value.trim(),
      bg: qs('#themeBg').value.trim(),
      bg2: qs('#themeBg2').value.trim(),
      surface: qs('#themeSurface').value.trim(),
      text: qs('#themeText').value.trim(),
      muted: qs('#themeMuted').value.trim(),
      line: qs('#themeLine').value.trim(),
    },
    meta: {
      title: qs('#metaTitle').value.trim(),
      description: qs('#metaDescription').value.trim(),
      ogTitle: qs('#metaOgTitle').value.trim(),
      ogDescription: qs('#metaOgDescription').value.trim(),
      ogImage: qs('#metaOgImage').value.trim(),
    },
    nav: {
      ctas: {
        primary: {
          label: qs('#navPrimaryLabel').value.trim(),
          href: qs('#navPrimaryHref').value.trim(),
        },
        secondary: {
          label: qs('#navSecondaryLabel').value.trim(),
          href: qs('#navSecondaryHref').value.trim(),
        },
      },
      links: readList(qs('#navLinksList'), (card) => ({
        label: qs('[data-field="label"]', card).value.trim(),
        href: qs('[data-field="href"]', card).value.trim(),
      })),
    },
    hero: {
      headline: qs('#heroHeadline').value.trim(),
      subheadline: qs('#heroSub').value.trim(),
      primaryCta: {
        label: qs('#ctaPrimaryLabel').value.trim(),
        href: qs('#ctaPrimaryHref').value.trim(),
      },
      secondaryCta: {
        label: qs('#ctaSecondaryLabel').value.trim(),
        href: qs('#ctaSecondaryHref').value.trim(),
      },
    },
    stats: readList(qs('#statsList'), (card) => ({
      value: qs('[data-field="value"]', card).value.trim(),
      label: qs('[data-field="label"]', card).value.trim(),
    })),
    features: readList(qs('#featuresList'), (card) => ({
      title: qs('[data-field="title"]', card).value.trim(),
      text: qs('[data-field="text"]', card).value.trim(),
    })),
    logos: readList(qs('#logosList'), (card) => ({
      label: qs('[data-field="label"]', card).value.trim(),
      imageUrl: qs('[data-field="imageUrl"]', card).value.trim(),
    })),
    pricing: {
      currency: qs('#pricingCurrency').value.trim() || 'USD',
      billingNote: qs('#pricingNote').value.trim(),
      tiers: readList(qs('#tiersList'), (card) => ({
        id: slugify(qs('[data-field="id"]', card).value.trim() || qs('[data-field="name"]', card).value.trim()),
        name: qs('[data-field="name"]', card).value.trim(),
        badge: qs('[data-field="badge"]', card).value.trim(),
        priceMonthly: normalizeNumber(qs('[data-field="priceMonthly"]', card).value.trim()),
        priceAnnual: normalizeNumber(qs('[data-field="priceAnnual"]', card).value.trim()),
        ctaLabel: qs('[data-field="ctaLabel"]', card).value.trim(),
        ctaHref: qs('[data-field="ctaHref"]', card).value.trim(),
        features: qs('[data-field="features"]', card).value.split('\n').map((line) => line.trim()).filter(Boolean),
        highlight: qs('[data-field="highlight"]', card).checked,
      })),
    },
    faqs: readList(qs('#faqsList'), (card) => ({
      q: qs('[data-field="q"]', card).value.trim(),
      a: qs('[data-field="a"]', card).value.trim(),
    })),
    footer: {
      company: qs('#footerCompany').value.trim(),
      email: qs('#footerEmail').value.trim(),
      address: qs('#footerAddress').value.trim(),
      links: readList(qs('#footerLinksList'), (card) => ({
        label: qs('[data-field="label"]', card).value.trim(),
        href: qs('[data-field="href"]', card).value.trim(),
      })),
      social: readList(qs('#socialLinksList'), (card) => ({
        label: qs('[data-field="label"]', card).value.trim(),
        href: qs('[data-field="href"]', card).value.trim(),
      })),
    },
    emails: {
      invite: {
        subject: qs('#inviteSubject').value.trim(),
        text: qs('#inviteText').value,
        html: qs('#inviteHtml').value,
      },
    },
    pages: state.pageDrafts || {},
    ui: {
      adminTheme: qs('#adminTheme').value,
      affiliateTheme: qs('#affiliateTheme').value,
      adminThemeTokens: {
        bg: qs('#adminThemeBg').value.trim(),
        panel: qs('#adminThemePanel').value.trim(),
        text: qs('#adminThemeText').value.trim(),
        muted: qs('#adminThemeMuted').value.trim(),
        accent: qs('#adminThemeAccent').value.trim(),
        accent2: qs('#adminThemeAccent2').value.trim(),
        border: qs('#adminThemeBorder').value.trim(),
      },
      affiliateThemeTokens: {
        bg: qs('#affiliateThemeBg').value.trim(),
        surface: qs('#affiliateThemeSurface').value.trim(),
        text: qs('#affiliateThemeText').value.trim(),
        muted: qs('#affiliateThemeMuted').value.trim(),
        accent: qs('#affiliateThemeAccent').value.trim(),
        accent2: qs('#affiliateThemeAccent2').value.trim(),
        line: qs('#affiliateThemeLine').value.trim(),
      },
      customThemes: state.customThemes || [],
    },
  };

  return config;
}

function normalizeNumber(value) {
  if (!value) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function slugify(value) {
  return (value || 'plan')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function bindRemove(containerSelector) {
  const container = qs(containerSelector);
  container.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action="remove"]');
    if (!btn) return;
    const card = btn.closest('.card');
    if (card) card.remove();
  });
}

async function loadConfig() {
  const res = await apiFetch('/api/site-config');
  return res.data || { draft: {}, published: null };
}

function applyConfig(config) {
  state.pageDrafts = JSON.parse(JSON.stringify(config.pages || {}));
  qs('#brandName').value = config.brand?.name || '';
  qs('#brandTagline').value = config.brand?.tagline || '';
  qs('#brandLogoUrl').value = config.brand?.logoUrl || '';
  qs('#brandLogoAlt').value = config.brand?.logoAlt || '';
  qs('#heroHeadline').value = config.hero?.headline || '';
  qs('#heroSub').value = config.hero?.subheadline || '';
  qs('#ctaPrimaryLabel').value = config.hero?.primaryCta?.label || '';
  qs('#ctaPrimaryHref').value = config.hero?.primaryCta?.href || '';
  qs('#ctaSecondaryLabel').value = config.hero?.secondaryCta?.label || '';
  qs('#ctaSecondaryHref').value = config.hero?.secondaryCta?.href || '';

  qs('#themeAccent').value = config.theme?.accent || '';
  qs('#themeAccent2').value = config.theme?.accent2 || '';
  qs('#themeBg').value = config.theme?.bg || '';
  qs('#themeBg2').value = config.theme?.bg2 || '';
  qs('#themeSurface').value = config.theme?.surface || '';
  qs('#themeText').value = config.theme?.text || '';
  qs('#themeMuted').value = config.theme?.muted || '';
  qs('#themeLine').value = config.theme?.line || '';

  qs('#metaTitle').value = config.meta?.title || '';
  qs('#metaDescription').value = config.meta?.description || '';
  qs('#metaOgTitle').value = config.meta?.ogTitle || '';
  qs('#metaOgDescription').value = config.meta?.ogDescription || '';
  qs('#metaOgImage').value = config.meta?.ogImage || '';

  qs('#navPrimaryLabel').value = config.nav?.ctas?.primary?.label || '';
  qs('#navPrimaryHref').value = config.nav?.ctas?.primary?.href || '';
  qs('#navSecondaryLabel').value = config.nav?.ctas?.secondary?.label || '';
  qs('#navSecondaryHref').value = config.nav?.ctas?.secondary?.href || '';

  qs('#pricingCurrency').value = config.pricing?.currency || 'USD';
  qs('#pricingNote').value = config.pricing?.billingNote || '';

  qs('#footerCompany').value = config.footer?.company || '';
  qs('#footerEmail').value = config.footer?.email || '';
  qs('#footerAddress').value = config.footer?.address || '';
  qs('#inviteSubject').value = config.emails?.invite?.subject || '';
  qs('#inviteText').value = config.emails?.invite?.text || '';
  qs('#inviteHtml').value = config.emails?.invite?.html || '';
  state.customThemes = Array.isArray(config.ui?.customThemes) ? config.ui.customThemes : [];
  const themes = getAllThemes();
  renderThemeOptions(qs('#adminTheme'), themes, config.ui?.adminTheme);
  renderThemeOptions(qs('#affiliateTheme'), themes, config.ui?.affiliateTheme);
  qs('#adminThemeBg').value = config.ui?.adminThemeTokens?.bg || '';
  qs('#adminThemePanel').value = config.ui?.adminThemeTokens?.panel || '';
  qs('#adminThemeText').value = config.ui?.adminThemeTokens?.text || '';
  qs('#adminThemeMuted').value = config.ui?.adminThemeTokens?.muted || '';
  qs('#adminThemeAccent').value = config.ui?.adminThemeTokens?.accent || '';
  qs('#adminThemeAccent2').value = config.ui?.adminThemeTokens?.accent2 || '';
  qs('#adminThemeBorder').value = config.ui?.adminThemeTokens?.border || '';
  qs('#affiliateThemeBg').value = config.ui?.affiliateThemeTokens?.bg || '';
  qs('#affiliateThemeSurface').value = config.ui?.affiliateThemeTokens?.surface || '';
  qs('#affiliateThemeText').value = config.ui?.affiliateThemeTokens?.text || '';
  qs('#affiliateThemeMuted').value = config.ui?.affiliateThemeTokens?.muted || '';
  qs('#affiliateThemeAccent').value = config.ui?.affiliateThemeTokens?.accent || '';
  qs('#affiliateThemeAccent2').value = config.ui?.affiliateThemeTokens?.accent2 || '';
  qs('#affiliateThemeLine').value = config.ui?.affiliateThemeTokens?.line || '';
  setupAdminPicker(themes);
  setupAffiliatePicker(themes);
  applyAdminThemePreview(config.ui?.adminTheme);

  renderStats(config.stats || []);
  renderFeatures(config.features || []);
  renderNavLinks(config.nav?.links || []);
  renderLogos(config.logos || []);
  renderTiers(config.pricing?.tiers || []);
  renderFaqs(config.faqs || []);
  renderFooterLinks(config.footer?.links || []);
  renderSocialLinks(config.footer?.social || []);

  renderPageEditorSelect();
  applyPageEditor(state.pageKey || 'about');
}

async function saveConfig() {
  try {
    const payload = collectConfig();
    await apiFetch('/api/site-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    showToast('Site settings saved');
  } catch (err) {
    showError(err, 'Failed to save');
  }
}

async function publishConfig() {
  try {
    await apiFetch('/api/site-config/publish', { method: 'POST' });
    showToast('Draft published to live site');
    await loadHistory();
  } catch (err) {
    showError(err, 'Failed to publish');
  }
}

async function loadHistory() {
  const res = await apiFetch('/api/site-config/history');
  const entries = res.data || [];
  state.history = entries;
  renderHistory(entries);
}

function renderHistory(entries) {
  const list = qs('#historyList');
  list.innerHTML = '';
  if (!entries.length) {
    list.innerHTML = '<div class=\"muted\">No history yet.</div>';
    return;
  }

  const latestPublish = entries.find((e) => e.action === 'published') || null;
  const lastPubEl = qs('#lastPublished');
  const lastPubBy = qs('#lastPublishedBy');
  if (latestPublish) {
    lastPubEl.textContent = `Last published: ${new Date(latestPublish.created_at).toLocaleString()}`;
    lastPubBy.textContent = latestPublish.user_email ? `By ${latestPublish.user_email}` : '';
  } else {
    lastPubEl.textContent = 'Last published: —';
    lastPubBy.textContent = '';
  }

  entries.forEach((entry) => {
    const card = document.createElement('div');
    card.className = 'card';
    const when = new Date(entry.created_at).toLocaleString();
    const who = entry.user_email || 'system';
    card.innerHTML = `
      <div class=\"row-between\">
        <div>
          <div><strong>${entry.action}</strong> · <span class=\"muted\">${when}</span></div>
          <div class=\"muted small\">${who}</div>
        </div>
        <div class=\"row\" style=\"gap:8px\">
          <button class=\"btn ghost\" data-action=\"diff\" data-id=\"${entry.id}\">View diff</button>
          <button class=\"btn\" data-action=\"rollback\" data-id=\"${entry.id}\">Load as draft</button>
        </div>
      </div>
    `;
    card.dataset.value = JSON.stringify(entry.value || {});
    list.appendChild(card);
  });
}

function showDiff(selected) {
  const diffPanel = qs('#diffPanel');
  const diffSelected = qs('#diffSelected');
  const diffDraft = qs('#diffDraft');
  const diffSummary = qs('#diffSummary');
  const draft = collectConfig();

  const selectedJson = JSON.stringify(selected, null, 2);
  const draftJson = JSON.stringify(draft, null, 2);
  const lineDiff = diffLines(selectedJson, draftJson);

  diffSelected.innerHTML = lineDiff.left.join('');
  diffDraft.innerHTML = lineDiff.right.join('');
  diffSummary.innerHTML = renderSummary(selected, draft);
  diffPanel.style.display = 'block';
}

async function rollbackTo(historyId) {
  try {
    const ok = window.confirm('Load this entry into the draft? This will overwrite your current draft.');
    if (!ok) return;
    const res = await apiFetch('/api/site-config/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history_id: historyId }),
    });
    applyConfig(res.data || {});
    showToast('Draft loaded from history');
    await loadHistory();
  } catch (err) {
    showError(err, 'Failed to rollback');
  }
}

function flatten(obj, prefix = '') {
  const out = {};
  Object.entries(obj || {}).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, path));
    } else {
      out[path] = value;
    }
  });
  return out;
}

function renderSummary(selected, draft) {
  const left = flatten(selected);
  const right = flatten(draft);
  const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const rows = [];

  Array.from(allKeys).sort().forEach((key) => {
    const a = left[key];
    const b = right[key];
    if (a === undefined) {
      rows.push(`<div class="diff-item diff-add">+ ${key}: ${formatValue(b)}</div>`);
    } else if (b === undefined) {
      rows.push(`<div class="diff-item diff-del">- ${key}: ${formatValue(a)}</div>`);
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      rows.push(`<div class="diff-item diff-change">~ ${key}: ${formatValue(a)} → ${formatValue(b)}</div>`);
    }
  });

  if (!rows.length) {
    return '<div class="muted">No differences found.</div>';
  }
  return rows.join('');
}

function formatValue(value) {
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return '{…}';
  return String(value);
}

function diffLines(leftText, rightText) {
  const left = leftText.split('\n');
  const right = rightText.split('\n');
  const matrix = Array(left.length + 1).fill(null).map(() => Array(right.length + 1).fill(0));

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      matrix[i][j] = left[i] === right[j]
        ? matrix[i + 1][j + 1] + 1
        : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }

  const leftOut = [];
  const rightOut = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      leftOut.push(formatDiffLine(left[i], 'eq'));
      rightOut.push(formatDiffLine(right[j], 'eq'));
      i += 1;
      j += 1;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      leftOut.push(formatDiffLine(left[i], 'del'));
      rightOut.push(formatDiffLine('', 'empty'));
      i += 1;
    } else {
      leftOut.push(formatDiffLine('', 'empty'));
      rightOut.push(formatDiffLine(right[j], 'add'));
      j += 1;
    }
  }
  while (i < left.length) {
    leftOut.push(formatDiffLine(left[i], 'del'));
    rightOut.push(formatDiffLine('', 'empty'));
    i += 1;
  }
  while (j < right.length) {
    leftOut.push(formatDiffLine('', 'empty'));
    rightOut.push(formatDiffLine(right[j], 'add'));
    j += 1;
  }

  return { left: leftOut, right: rightOut };
}

function formatDiffLine(line, type) {
  const safe = line.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  return `<div class="diff-line diff-${type}">${safe || '&nbsp;'}</div>`;
}

function exportHistory() {
  if (!state.history.length) {
    showToast('No history to export', 'error');
    return;
  }
  const header = ['id', 'action', 'created_at', 'user_email'];
  const rows = state.history.map((entry) => [
    entry.id,
    entry.action,
    entry.created_at,
    entry.user_email || '',
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `site-history-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const v = String(value ?? '');
  if (v.includes(',') || v.includes('\"') || v.includes('\\n')) {
    return `\"${v.replace(/\"/g, '\"\"')}\"`;
  }
  return v;
}

function addStat() {
  const list = qs('#statsList');
  const item = document.createElement('div');
  item.className = 'card';
  item.innerHTML = `
    <label class="muted">Value</label>
    <input class="input" data-field="value" value="">
    <label class="muted" style="margin-top:10px">Label</label>
    <input class="input" data-field="label" value="">
    <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
  `;
  list.appendChild(item);
}

function addFeature() {
  const list = qs('#featuresList');
  const item = document.createElement('div');
  item.className = 'card';
  item.innerHTML = `
    <label class="muted">Title</label>
    <input class="input" data-field="title" value="">
    <label class="muted" style="margin-top:10px">Text</label>
    <input class="input" data-field="text" value="">
    <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
  `;
  list.appendChild(item);
}

function addNavLink() {
  const list = qs('#navLinksList');
  const item = document.createElement('div');
  item.className = 'card';
  item.innerHTML = `
    <label class="muted">Label</label>
    <input class="input" data-field="label" value="">
    <label class="muted" style="margin-top:10px">URL</label>
    <input class="input" data-field="href" value="">
    <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
  `;
  list.appendChild(item);
}

function addLogo() {
  const list = qs('#logosList');
  const item = document.createElement('div');
  item.className = 'card';
  item.innerHTML = `
    <label class="muted">Label</label>
    <input class="input" data-field="label" value="">
    <label class="muted" style="margin-top:10px">Image URL (optional)</label>
    <input class="input" data-field="imageUrl" value="">
    <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
  `;
  list.appendChild(item);
}

function addFooterLink() {
  const list = qs('#footerLinksList');
  const item = document.createElement('div');
  item.className = 'card';
  item.innerHTML = `
    <label class="muted">Label</label>
    <input class="input" data-field="label" value="">
    <label class="muted" style="margin-top:10px">URL</label>
    <input class="input" data-field="href" value="">
    <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
  `;
  list.appendChild(item);
}

function addSocialLink() {
  const list = qs('#socialLinksList');
  const item = document.createElement('div');
  item.className = 'card';
  item.innerHTML = `
    <label class="muted">Label</label>
    <input class="input" data-field="label" value="">
    <label class="muted" style="margin-top:10px">URL</label>
    <input class="input" data-field="href" value="">
    <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
  `;
  list.appendChild(item);
}

function addTier() {
  const list = qs('#tiersList');
  const item = document.createElement('div');
  item.className = 'card';
  item.innerHTML = `
    <div class="row">
      <div style="flex:1">
        <label class="muted">Plan ID (stable)</label>
        <input class="input" data-field="id" value="">
      </div>
      <div style="flex:1">
        <label class="muted">Name</label>
        <input class="input" data-field="name" value="">
      </div>
    </div>
    <div class="row" style="margin-top:10px">
      <div style="flex:1">
        <label class="muted">Badge</label>
        <input class="input" data-field="badge" value="">
      </div>
      <div style="flex:1">
        <label class="muted">CTA label</label>
        <input class="input" data-field="ctaLabel" value="">
      </div>
    </div>
    <div class="row" style="margin-top:10px">
      <div style="flex:1">
        <label class="muted">Monthly price</label>
        <input class="input" data-field="priceMonthly" value="">
      </div>
      <div style="flex:1">
        <label class="muted">Annual price</label>
        <input class="input" data-field="priceAnnual" value="">
      </div>
    </div>
    <div class="row" style="margin-top:10px">
      <div style="flex:1">
        <label class="muted">CTA URL</label>
        <input class="input" data-field="ctaHref" value="">
      </div>
    </div>
    <label class="muted" style="margin-top:10px">Features (one per line)</label>
    <textarea class="input" data-field="features" rows="4"></textarea>
    <label class="row" style="margin-top:10px;gap:8px">
      <input type="checkbox" data-field="highlight">
      <span class="muted">Highlight this tier</span>
    </label>
    <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
  `;
  list.appendChild(item);
}

function addFaq() {
  const list = qs('#faqsList');
  const item = document.createElement('div');
  item.className = 'card';
  item.innerHTML = `
    <label class="muted">Question</label>
    <input class="input" data-field="q" value="">
    <label class="muted" style="margin-top:10px">Answer</label>
    <input class="input" data-field="a" value="">
    <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
  `;
  list.appendChild(item);
}

function renderPageEditorSelect() {
  const select = qs('#pageEditorSelect');
  const options = [
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' },
    { id: 'caseStudies', label: 'Case studies' },
    { id: 'useCases', label: 'Use cases' },
    { id: 'home', label: 'Home (hero/FAQ overrides)' },
  ];
  select.innerHTML = options.map((opt) => `<option value="${opt.id}">${opt.label}</option>`).join('');
  select.value = state.pageKey || 'about';
}

function getPageDraft(key) {
  if (!state.pageDrafts[key]) state.pageDrafts[key] = {};
  return state.pageDrafts[key];
}

function applyPageEditor(key) {
  state.pageKey = key;
  const page = getPageDraft(key);
  if (key === 'home') {
    qs('#pageTitle').value = page.hero?.headline || '';
    qs('#pageSubtitle').value = page.hero?.subheadline || '';
  } else {
    qs('#pageTitle').value = page.title || '';
    qs('#pageSubtitle').value = page.subtitle || '';
  }
  qs('#pageCtaPrimaryLabel').value = page.ctaPrimary?.label || page.hero?.primaryCta?.label || '';
  qs('#pageCtaPrimaryHref').value = page.ctaPrimary?.href || page.hero?.primaryCta?.href || '';
  qs('#pageCtaSecondaryLabel').value = page.ctaSecondary?.label || page.hero?.secondaryCta?.label || '';
  qs('#pageCtaSecondaryHref').value = page.ctaSecondary?.href || page.hero?.secondaryCta?.href || '';
  qs('#pageSupportEmail').value = page.supportEmail || '';
  qs('#pageContactSubject').value = page.formSubject || '';
  qs('#pageContactSubmit').value = page.formSubmitLabel || '';
  qs('#pageContactSuccess').value = page.formSuccess || '';
  renderPageCards(page.cards || []);
  renderPageBody(page.body || []);
  renderPageFaqs(page.faqs || []);
}

function savePageEditor() {
  if (!state.pageKey) return;
  const page = getPageDraft(state.pageKey);
  const title = qs('#pageTitle').value.trim();
  const subtitle = qs('#pageSubtitle').value.trim();
  const ctaPrimary = {
    label: qs('#pageCtaPrimaryLabel').value.trim(),
    href: qs('#pageCtaPrimaryHref').value.trim(),
  };
  const ctaSecondary = {
    label: qs('#pageCtaSecondaryLabel').value.trim(),
    href: qs('#pageCtaSecondaryHref').value.trim(),
  };
  if (state.pageKey === 'home') {
    page.hero = {
      headline: title,
      subheadline: subtitle,
      primaryCta: ctaPrimary,
      secondaryCta: ctaSecondary,
    };
  } else {
    page.title = title;
    page.subtitle = subtitle;
    page.ctaPrimary = ctaPrimary;
    page.ctaSecondary = ctaSecondary;
  }
  page.supportEmail = qs('#pageSupportEmail').value.trim();
  page.formSubject = qs('#pageContactSubject').value.trim();
  page.formSubmitLabel = qs('#pageContactSubmit').value.trim();
  page.formSuccess = qs('#pageContactSuccess').value.trim();
  page.cards = readList(qs('#pageCardsList'), (card) => ({
    title: qs('[data-field="title"]', card).value.trim(),
    text: qs('[data-field="text"]', card).value.trim(),
  }));
  page.body = readList(qs('#pageBodyList'), (card) => (
    qs('[data-field="text"]', card).value.trim()
  ));
  page.faqs = readList(qs('#pageFaqsList'), (card) => ({
    q: qs('[data-field="q"]', card).value.trim(),
    a: qs('[data-field="a"]', card).value.trim(),
  }));
}

function renderTemplate(template, vars) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => (
    key in vars ? vars[key] : match
  ));
}

function buildInvitePreviewVars() {
  return {
    brandName: qs('#brandName').value.trim() || 'OkLeaf',
    supportEmail: qs('#footerEmail').value.trim() || 'support@okleaf.link',
    inviter: 'Admin Preview',
    inviteUrl: `${window.location.origin}/register.html?invite=example`,
  };
}

function showInvitePreview() {
  const panel = qs('#invitePreviewPanel');
  const previewText = qs('#invitePreviewText');
  const previewHtml = qs('#invitePreviewHtml');
  const vars = buildInvitePreviewVars();
  const subject = qs('#inviteSubject').value.trim();
  const text = qs('#inviteText').value;
  const html = qs('#inviteHtml').value;

  const renderedText = renderTemplate(text || '', vars);
  const renderedHtml = renderTemplate(html || '', vars);
  const renderedSubject = renderTemplate(subject || '', vars);

  previewText.textContent = `Subject: ${renderedSubject}\n\n${renderedText}`;
  previewHtml.innerHTML = renderedHtml || '<div class="muted">No HTML template provided.</div>';
  panel.style.display = 'block';
}

async function sendInviteTest() {
  const to = qs('#inviteTestTo').value.trim();
  if (!to) {
    showToast('Test email address is required', 'error');
    return;
  }
  const payload = {
    to,
    template: {
      subject: qs('#inviteSubject').value.trim(),
      text: qs('#inviteText').value,
      html: qs('#inviteHtml').value,
    },
  };
  await apiFetch('/api/site-config/email-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  showToast('Test email sent');
}

async function init() {
  try {
    state.config = await loadConfig();
    applyConfig(state.config.draft || {});
  } catch (err) {
    showError(err, 'Unable to load site settings');
  }

  qs('#saveBtn').addEventListener('click', saveConfig);
  qs('#publishBtn').addEventListener('click', publishConfig);
  qs('#refreshHistoryBtn').addEventListener('click', loadHistory);
  qs('#exportHistoryBtn').addEventListener('click', exportHistory);
  qs('#closeDiffBtn').addEventListener('click', () => {
    qs('#diffPanel').style.display = 'none';
  });
  qs('#addStatBtn').addEventListener('click', addStat);
  qs('#addFeatureBtn').addEventListener('click', addFeature);
  qs('#addNavLinkBtn').addEventListener('click', addNavLink);
  qs('#addLogoBtn').addEventListener('click', addLogo);
  qs('#addTierBtn').addEventListener('click', addTier);
  qs('#addFaqBtn').addEventListener('click', addFaq);
  qs('#addFooterLinkBtn').addEventListener('click', addFooterLink);
  qs('#addSocialLinkBtn').addEventListener('click', addSocialLink);
  qs('#addPageCardBtn').addEventListener('click', () => {
    const list = qs('#pageCardsList');
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <label class="muted">Title</label>
      <input class="input" data-field="title" value="">
      <label class="muted" style="margin-top:10px">Text</label>
      <input class="input" data-field="text" value="">
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
  qs('#addPageBodyBtn').addEventListener('click', () => {
    const list = qs('#pageBodyList');
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <label class="muted">Paragraph</label>
      <textarea class="input" data-field="text" rows="3"></textarea>
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
  qs('#addPageFaqBtn').addEventListener('click', () => {
    const list = qs('#pageFaqsList');
    const item = document.createElement('div');
    item.className = 'card';
    item.innerHTML = `
      <label class="muted">Question</label>
      <input class="input" data-field="q" value="">
      <label class="muted" style="margin-top:10px">Answer</label>
      <input class="input" data-field="a" value="">
      <button class="btn danger" data-action="remove" style="margin-top:12px">Remove</button>
    `;
    list.appendChild(item);
  });
  qs('#pageEditorSelect').addEventListener('change', (event) => {
    savePageEditor();
    applyPageEditor(event.target.value);
  });
  qs('#invitePreviewBtn').addEventListener('click', showInvitePreview);
  qs('#invitePreviewCloseBtn').addEventListener('click', () => {
    qs('#invitePreviewPanel').style.display = 'none';
  });
  qs('#inviteSendTestBtn').addEventListener('click', async () => {
    try {
      await sendInviteTest();
    } catch (err) {
      showError(err, 'Failed to send test email');
    }
  });
  qs('#adminTheme').addEventListener('change', (event) => {
    const themes = getAllThemes();
    applyAdminThemePreview(event.target.value);
    setupAdminPicker(themes);
  });
  qs('#affiliateTheme').addEventListener('change', (event) => {
    const themes = getAllThemes();
    setupAffiliatePicker(themes);
  });
  qs('#exportThemeBtn').addEventListener('click', () => {
    const payload = {
      ui: {
        adminTheme: qs('#adminTheme').value,
        affiliateTheme: qs('#affiliateTheme').value,
        adminThemeTokens: {
          bg: qs('#adminThemeBg').value.trim(),
          panel: qs('#adminThemePanel').value.trim(),
          text: qs('#adminThemeText').value.trim(),
          muted: qs('#adminThemeMuted').value.trim(),
          accent: qs('#adminThemeAccent').value.trim(),
          accent2: qs('#adminThemeAccent2').value.trim(),
          border: qs('#adminThemeBorder').value.trim(),
        },
        affiliateThemeTokens: {
          bg: qs('#affiliateThemeBg').value.trim(),
          surface: qs('#affiliateThemeSurface').value.trim(),
          text: qs('#affiliateThemeText').value.trim(),
          muted: qs('#affiliateThemeMuted').value.trim(),
          accent: qs('#affiliateThemeAccent').value.trim(),
          accent2: qs('#affiliateThemeAccent2').value.trim(),
          line: qs('#affiliateThemeLine').value.trim(),
        },
        customThemes: state.customThemes || [],
      },
    };
    qs('#themeJson').value = JSON.stringify(payload, null, 2);
    showToast('Theme JSON generated');
  });
  qs('#copyThemeBtn').addEventListener('click', async () => {
    const text = qs('#themeJson').value.trim();
    if (!text) {
      showToast('Nothing to copy', 'error');
      return;
    }
    await navigator.clipboard.writeText(text);
    showToast('Theme JSON copied');
  });
  qs('#importThemeBtn').addEventListener('click', () => {
    try {
      const raw = qs('#themeJson').value.trim();
      if (!raw) {
        showToast('Paste theme JSON first', 'error');
        return;
      }
      const parsed = JSON.parse(raw);
      const ui = parsed.ui || parsed;
      state.customThemes = Array.isArray(ui.customThemes) ? ui.customThemes : [];
      const themes = getAllThemes();
      renderThemeOptions(qs('#adminTheme'), themes, ui.adminTheme || qs('#adminTheme').value);
      renderThemeOptions(qs('#affiliateTheme'), themes, ui.affiliateTheme || qs('#affiliateTheme').value);
      qs('#adminTheme').value = ui.adminTheme || qs('#adminTheme').value;
      qs('#affiliateTheme').value = ui.affiliateTheme || qs('#affiliateTheme').value;
      qs('#adminThemeBg').value = ui.adminThemeTokens?.bg || '';
      qs('#adminThemePanel').value = ui.adminThemeTokens?.panel || '';
      qs('#adminThemeText').value = ui.adminThemeTokens?.text || '';
      qs('#adminThemeMuted').value = ui.adminThemeTokens?.muted || '';
      qs('#adminThemeAccent').value = ui.adminThemeTokens?.accent || '';
      qs('#adminThemeAccent2').value = ui.adminThemeTokens?.accent2 || '';
      qs('#adminThemeBorder').value = ui.adminThemeTokens?.border || '';
      qs('#affiliateThemeBg').value = ui.affiliateThemeTokens?.bg || '';
      qs('#affiliateThemeSurface').value = ui.affiliateThemeTokens?.surface || '';
      qs('#affiliateThemeText').value = ui.affiliateThemeTokens?.text || '';
      qs('#affiliateThemeMuted').value = ui.affiliateThemeTokens?.muted || '';
      qs('#affiliateThemeAccent').value = ui.affiliateThemeTokens?.accent || '';
      qs('#affiliateThemeAccent2').value = ui.affiliateThemeTokens?.accent2 || '';
      qs('#affiliateThemeLine').value = ui.affiliateThemeTokens?.line || '';
      setupAdminPicker(themes);
      setupAffiliatePicker(themes);
      applyAdminThemePreview(qs('#adminTheme').value);
      showToast('Theme JSON imported');
    } catch (err) {
      showError(err, 'Invalid theme JSON');
    }
  });
  qs('#saveThemeBtn').addEventListener('click', () => {
    const name = qs('#customThemeName').value.trim();
    if (!name) {
      showToast('Theme name is required', 'error');
      return;
    }
    const id = slugify(name);
    const adminTokens = {
      bg: qs('#adminThemeBg').value.trim(),
      panel: qs('#adminThemePanel').value.trim(),
      text: qs('#adminThemeText').value.trim(),
      muted: qs('#adminThemeMuted').value.trim(),
      accent: qs('#adminThemeAccent').value.trim(),
      accent2: qs('#adminThemeAccent2').value.trim(),
      border: qs('#adminThemeBorder').value.trim(),
    };
    const affiliateTokens = {
      bg: qs('#affiliateThemeBg').value.trim(),
      surface: qs('#affiliateThemeSurface').value.trim(),
      text: qs('#affiliateThemeText').value.trim(),
      muted: qs('#affiliateThemeMuted').value.trim(),
      accent: qs('#affiliateThemeAccent').value.trim(),
      accent2: qs('#affiliateThemeAccent2').value.trim(),
      line: qs('#affiliateThemeLine').value.trim(),
    };
    const preview = {
      bg: adminTokens.bg || '#0b0d10',
      accent: adminTokens.accent || '#e0b15a',
      accent2: adminTokens.accent2 || '#2fb7b2',
    };
    const existingIdx = (state.customThemes || []).findIndex((t) => t.id === id);
    const nextTheme = { id, label: name, ...preview, adminTokens, affiliateTokens };
    if (!state.customThemes) state.customThemes = [];
    if (existingIdx >= 0) {
      const ok = window.confirm('Theme exists. Overwrite it?');
      if (!ok) return;
      state.customThemes[existingIdx] = nextTheme;
    } else {
      state.customThemes.push(nextTheme);
    }
    const themes = getAllThemes();
    renderThemeOptions(qs('#adminTheme'), themes, id);
    renderThemeOptions(qs('#affiliateTheme'), themes, id);
    setupAdminPicker(themes);
    setupAffiliatePicker(themes);
    qs('#customThemeName').value = '';
    showToast('Theme saved. Save draft to keep.');
  });
  qs('#previewOpenBtn').addEventListener('click', () => {
    qs('#previewModal').style.display = 'flex';
    const pageId = qs('#previewPageSelect').value || 'home';
    const href = resolvePreviewHref(pageId);
    qs('#previewModalFrame').src = `${href}?preview=1&ts=${Date.now()}`;
    qs('#previewModalPageSelect').value = pageId;
  });
  qs('#previewCloseBtn').addEventListener('click', () => {
    qs('#previewModal').style.display = 'none';
  });
  qs('#previewFullscreenBtn').addEventListener('click', () => {
    const modal = qs('#previewModal');
    if (modal.requestFullscreen) modal.requestFullscreen();
  });
  qs('#previewModal').addEventListener('click', (event) => {
    if (event.target.id === 'previewModal') {
      qs('#previewModal').style.display = 'none';
    }
  });
  qs('#previewModal').querySelectorAll('[data-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const frame = qs('#previewModalFrame');
      const mode = btn.dataset.size;
      if (mode === 'mobile') {
        frame.style.width = '390px';
        frame.style.height = '740px';
      } else if (mode === 'tablet') {
        frame.style.width = '820px';
        frame.style.height = '720px';
      } else {
        frame.style.width = '1200px';
        frame.style.height = '720px';
      }
    });
  });
  renderPreviewSelect(qs('#previewPageSelect'), 'home');
  renderPreviewSelect(qs('#previewModalPageSelect'), 'home');
  qs('#previewPageSelect').addEventListener('change', (event) => {
    const frame = qs('#previewFrame');
    const href = resolvePreviewHref(event.target.value);
    frame.src = `${href}?preview=1&ts=${Date.now()}`;
  });
  qs('#previewModalPageSelect').addEventListener('change', (event) => {
    const frame = qs('#previewModalFrame');
    const href = resolvePreviewHref(event.target.value);
    frame.src = `${href}?preview=1&ts=${Date.now()}`;
  });
  qs('#previewRefreshBtn').addEventListener('click', () => {
    const frame = qs('#previewFrame');
    const href = resolvePreviewHref(qs('#previewPageSelect').value || 'home');
    frame.src = `${href}?preview=1&ts=${Date.now()}`;
  });
  qs('#seedPremiumBtn').addEventListener('click', () => {
    const ok = window.confirm('Load the premium preset? This will replace your current draft values in the form (not published yet).');
    if (!ok) return;
    const base = state.config?.draft || {};
    applyConfig(mergeDeep(base, PREMIUM_PRESET));
    showToast('Premium preset loaded. Save to keep.');
  });

  bindRemove('#statsList');
  bindRemove('#featuresList');
  bindRemove('#navLinksList');
  bindRemove('#logosList');
  bindRemove('#tiersList');
  bindRemove('#faqsList');
  bindRemove('#footerLinksList');
  bindRemove('#socialLinksList');
  bindRemove('#pageCardsList');
  bindRemove('#pageBodyList');
  bindRemove('#pageFaqsList');

  qs('#historyList').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const card = btn.closest('.card');
    const value = JSON.parse(card.dataset.value || '{}');
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === 'diff') showDiff(value);
    if (action === 'rollback') rollbackTo(id);
  });

  await loadHistory();
}

init();

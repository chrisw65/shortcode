const byId = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);

function getPreviewMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('preview') === '1';
}

async function fetchConfig() {
  const preview = getPreviewMode();
  const headers = {};
  let path = '/api/public/site-config';
  if (preview) {
    const token = localStorage.getItem('admin_token') || '';
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      path = '/api/site-config';
    }
  }

  const res = await fetch(path, { credentials: 'same-origin', headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Failed to load site config');
  if (preview && data?.data?.draft) return data.data.draft;
  return data.data || {};
}

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value ?? '';
}

function setTextBind(key, value) {
  const nodes = Array.from(document.querySelectorAll(`[data-bind="${key}"]`));
  if (!nodes.length) return;
  nodes.forEach((node) => {
    node.textContent = value ?? '';
  });
}

function setTextSelector(selector, value) {
  const el = document.querySelector(selector);
  if (el && value) el.textContent = value;
}

function setHref(id, value) {
  const el = byId(id);
  if (el && value) el.href = value;
}

function setMeta(selector, value, attr = 'content') {
  const el = document.querySelector(selector);
  if (el && value) el.setAttribute(attr, value);
}

function applyTheme(theme = {}) {
  const root = document.documentElement;
  const map = {
    bg: '--bg',
    bg2: '--bg-2',
    surface: '--surface',
    text: '--text',
    muted: '--muted',
    accent: '--accent',
    accent2: '--accent-2',
    line: '--line',
  };
  Object.entries(map).forEach(([key, cssVar]) => {
    const value = theme[key];
    if (value) root.style.setProperty(cssVar, value);
  });
}

function renderNavLinks(links = []) {
  const nav = qs('[data-nav-links]');
  if (!nav) return;
  const baseLinks = Array.isArray(links) ? links : [];
  if (!baseLinks.length) return;
  const normalized = [...baseLinks];
  if (!normalized.some((link) => link.href === '/ecosystem.html')) {
    normalized.push({ label: 'Ecosystem', href: '/ecosystem.html' });
  }
  nav.innerHTML = normalized.map((link) => (
    `<a href="${link.href || '#'}">${link.label || ''}</a>`
  )).join('');
}

function renderNavCtas(ctas = {}) {
  const wrap = qs('[data-nav-ctas]');
  if (!wrap) return;
  const primary = ctas.primary || {};
  const secondary = ctas.secondary || {};
  const primaryLabel = primary.label || 'Start free';
  const primaryHref = primary.href || '/register.html';
  const secondaryLabel = secondary.label || 'Login';
  const secondaryHref = secondary.href || '/login.html';
  wrap.innerHTML = `
    <a class="btn ghost small" href="${secondaryHref}">${secondaryLabel}</a>
    <a class="btn primary small" href="${primaryHref}">${primaryLabel}</a>
  `;
}

function renderLogos(logos = []) {
  const wrap = qs('[data-logos]');
  if (!wrap || !logos.length) return;
  wrap.innerHTML = logos.map((logo) => {
    if (logo.imageUrl) {
      return `<img src="${logo.imageUrl}" alt="${logo.label || 'Logo'}">`;
    }
    return `<span>${logo.label || ''}</span>`;
  }).join('');
}

function renderFooterLinks(links = []) {
  const wrap = qs('[data-footer-links]');
  if (!wrap || !links.length) return;
  wrap.innerHTML = links.map((link) => (
    `<a href="${link.href || '#'}">${link.label || ''}</a>`
  )).join('');
}

const SOCIAL_ICON_SVGS = {
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3l7.7 9.2L4.7 21H7.3l5-6 5.1 6H20l-7.9-9.5L19.1 3h-2.6l-4.7 5.6L6.2 3H4z" fill="currentColor"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.9 7.4c0 .2 0 .4-.1.6-.5 5.9-4.6 10.1-10.2 10.1-2 0-3.9-.6-5.5-1.6h1c1.6 0 3.1-.5 4.3-1.4-1.5 0-2.8-1-3.2-2.4.5.1 1 .1 1.5-.1-1.6-.3-2.8-1.8-2.8-3.4v-.1c.5.3 1 .5 1.6.5-1-.7-1.5-2-1-3.2 1.7 2 4.3 3.4 7.2 3.5-.4-1.7.9-3.4 2.7-3.4.8 0 1.6.3 2.1.9.7-.1 1.3-.4 1.9-.7-.2.7-.7 1.2-1.3 1.6.6-.1 1.1-.2 1.6-.4-.4.6-.9 1.1-1.4 1.5z" fill="currentColor"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.98 3.5c0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8S2.2 1.7 3.2 1.7s1.8.8 1.8 1.8zM1.6 8.2h3.2V22H1.6V8.2zM8.7 8.2h3.1v1.9h.1c.4-.7 1.5-2.1 3.5-2.1 3.7 0 4.4 2.4 4.4 5.5V22h-3.2v-6.5c0-1.6 0-3.7-2.3-3.7s-2.6 1.7-2.6 3.6V22H8.7V8.2z" fill="currentColor"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 9.2V7.2c0-.7.5-1.1 1.2-1.1h1.6V3.2h-2.2c-2.4 0-3.9 1.6-3.9 3.8v2.2H8v2.9h2.2V22h3.3v-9.9h2.7l.4-2.9h-3.1z" fill="currentColor"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7zm5 3.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2zm0 2a1.8 1.8 0 1 0 1.8 1.8A1.8 1.8 0 0 0 12 10.2zM17.6 6.3a.9.9 0 1 1-.9-.9.9.9 0 0 1 .9.9z" fill="currentColor"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12s0-3.3-.4-4.8c-.2-.8-.9-1.5-1.7-1.7C18.4 5 12 5 12 5s-6.4 0-7.9.5c-.8.2-1.5.9-1.7 1.7C2 8.7 2 12 2 12s0 3.3.4 4.8c.2.8.9 1.5 1.7 1.7C5.6 19 12 19 12 19s6.4 0 7.9-.5c.8-.2 1.5-.9 1.7-1.7.4-1.5.4-4.8.4-4.8zM10 15.3V8.7l5.2 3.3L10 15.3z" fill="currentColor"/></svg>',
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.5 2 2 6.6 2 12.3c0 4.6 2.9 8.5 6.9 9.9.5.1.7-.2.7-.5v-2c-2.8.6-3.4-1.2-3.4-1.2-.5-1.3-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 .1 2-.7 2.3-1.3.1-.7.4-1.2.7-1.5-2.2-.3-4.6-1.1-4.6-5a4 4 0 0 1 1-2.8 3.7 3.7 0 0 1 .1-2.8s.9-.3 2.9 1a10 10 0 0 1 5.2 0c2-1.3 2.9-1 2.9-1a3.7 3.7 0 0 1 .1 2.8 4 4 0 0 1 1 2.8c0 3.9-2.4 4.7-4.7 5 .4.3.8 1 .8 2.1v3.1c0 .3.2.6.7.5 4-1.4 6.9-5.3 6.9-9.9C22 6.6 17.5 2 12 2z" fill="currentColor"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2h2.1c.3 2 1.7 3.6 3.7 3.9V8c-1.6 0-3.1-.6-4.2-1.6v7.4a5.2 5.2 0 1 1-4.4-5.1v2.3a2.9 2.9 0 1 0 2.3 2.8V2z" fill="currentColor"/></svg>',
};

const SOCIAL_ALIASES = {
  twitter: 'x',
  x: 'x',
  linkedin: 'linkedin',
  facebook: 'facebook',
  instagram: 'instagram',
  youtube: 'youtube',
  github: 'github',
  tiktok: 'tiktok',
};

function resolveSocialKey(link = {}) {
  const rawIcon = String(link.icon || '').trim().toLowerCase();
  if (rawIcon && rawIcon !== 'auto') return SOCIAL_ALIASES[rawIcon] || rawIcon;
  const label = String(link.label || '').trim().toLowerCase();
  const href = String(link.href || '').trim().toLowerCase();
  if (href.includes('linkedin')) return 'linkedin';
  if (href.includes('x.com') || href.includes('twitter.com')) return 'x';
  if (href.includes('facebook.com')) return 'facebook';
  if (href.includes('instagram.com')) return 'instagram';
  if (href.includes('youtube.com') || href.includes('youtu.be')) return 'youtube';
  if (href.includes('github.com')) return 'github';
  if (href.includes('tiktok.com')) return 'tiktok';
  if (label) return SOCIAL_ALIASES[label] || label;
  return '';
}

function renderSocialLinks(links = []) {
  const wrap = qs('[data-social-links]');
  if (!wrap || !links.length) return;
  wrap.innerHTML = links.map((link) => {
    const href = link.href || '#';
    const label = link.label || 'Social';
    const key = resolveSocialKey(link);
    const icon = key && SOCIAL_ICON_SVGS[key] ? SOCIAL_ICON_SVGS[key] : '';
    const iconHtml = icon ? `<span class="social-icon" aria-hidden="true">${icon}</span>` : '';
    const labelHtml = `<span class="social-label">${label}</span>`;
    return `<a class="social-link" href="${href}" target="_blank" rel="noreferrer" aria-label="${label}">${iconHtml}${labelHtml}</a>`;
  }).join('');
}

function applyBrandLogo(brand = {}) {
  const badge = qs('[data-brand-badge]');
  if (!badge) return;
  if (brand.logoUrl) {
    const alt = brand.logoAlt || brand.name || 'Logo';
    badge.innerHTML = `<img src="${brand.logoUrl}" alt="${alt}">`;
  } else if (brand.name) {
    badge.textContent = brand.name.slice(0, 1).toUpperCase();
  }
}

function renderStats(stats = []) {
  const wrap = qs('[data-stats]');
  if (!wrap) return;
  wrap.innerHTML = stats.map((s) => (
    `<div class="stat-card"><strong>${s.value || ''}</strong><span>${s.label || ''}</span></div>`
  )).join('');
}

function renderFeatures(features = []) {
  const wrap = qs('[data-features]');
  if (!wrap) return;
  wrap.innerHTML = features.map((f) => (
    `<div class="feature-card"><h4>${f.title || ''}</h4><p>${f.text || ''}</p></div>`
  )).join('');
}

function renderEcosystemFeatures(features = []) {
  const wrap = qs('[data-ecosystem-features]');
  if (!wrap) return;
  wrap.innerHTML = features.map((f) => (
    `<div class="feature-card"><h4>${f.title || ''}</h4><p>${f.text || ''}</p></div>`
  )).join('');
}

function renderEcosystemInsights(insights = []) {
  const wrap = qs('[data-ecosystem-insights]');
  if (!wrap) return;
  wrap.innerHTML = insights.map((item) => (`
    <div class="hero-tile">
      <div class="muted">${item.label || ''}</div>
      <strong>${item.value || ''}</strong>
      <div class="small muted">${item.detail || ''}</div>
    </div>
  `)).join('');
}

function renderEcosystemTools(tools = []) {
  const wrap = qs('[data-ecosystem-tools]');
  if (!wrap) return;
  wrap.innerHTML = tools.map((tool) => (`
    <div class="tool-card">
      <h3>${tool.title || ''}</h3>
      <p>${tool.text || ''}</p>
    </div>
  `)).join('');
}

function renderPageCards(cards = [], variant = 'feature', selector = '[data-page-cards]') {
  const wrap = qs(selector);
  if (!wrap) return;
  const isCase = variant === 'case';
  wrap.innerHTML = cards.map((card) => (
    isCase
      ? `<div class="case-card"><h3>${card.title || ''}</h3><p>${card.text || ''}</p></div>`
      : `<div class="feature-card"><h4>${card.title || ''}</h4><p>${card.text || ''}</p></div>`
  )).join('');
}

function renderPageBody(paragraphs = []) {
  const wrap = qs('[data-page-body]');
  if (!wrap) return;
  wrap.innerHTML = paragraphs.map((p) => `<p>${p || ''}</p>`).join('');
}

function renderAuthBullets(items = []) {
  const wrap = qs('[data-page-bullets]');
  if (!wrap) return;
  if (!items.length) {
    wrap.innerHTML = '';
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  wrap.innerHTML = items.map((item) => `<li>${item}</li>`).join('');
}

function renderHomeCardMetrics(metrics = []) {
  const wrap = qs('[data-home-card-metrics]');
  if (!wrap) return;
  const items = metrics.filter((metric) => metric.label || metric.value);
  if (!items.length) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = items.map((metric) => (
    `<div class="hero-tile"><div class="muted">${metric.label || ''}</div><strong>${metric.value || ''}</strong></div>`
  )).join('');
}

function renderHomeBadges(badges = []) {
  const wrap = qs('[data-home-card-badges]');
  if (!wrap) return;
  const items = badges.filter(Boolean);
  if (!items.length) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = items.map((badge) => `<span class="pill">${badge}</span>`).join('');
}

function renderSparkline(points = []) {
  const wrap = qs('[data-home-sparkline]');
  if (!wrap) return;
  const values = points.filter((num) => Number.isFinite(num));
  if (!values.length) {
    wrap.innerHTML = '';
    return;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 100;
  const height = 40;
  const step = width / (values.length - 1 || 1);
  const path = values.map((val, idx) => {
    const x = idx * step;
    const y = height - ((val - min) / range) * height;
    return `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  wrap.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${path}" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>
  `;
}

function sanitizeDocsHtml(html) {
  if (!html) return '';
  const allowedTags = new Set([
    'section', 'div', 'h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong',
    'em', 'b', 'i', 'u', 'a', 'pre', 'code', 'span', 'br',
  ]);
  const allowedAttrs = new Set(['class', 'href', 'target', 'rel']);
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const isSafeHref = (value) => (
    value.startsWith('/') ||
    value.startsWith('#') ||
    value.startsWith('mailto:') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  );

  const walk = (node) => {
    const children = Array.from(node.children);
    children.forEach((child) => {
      const tag = child.tagName.toLowerCase();
      if (!allowedTags.has(tag)) {
        child.replaceWith(...Array.from(child.childNodes));
        return;
      }
      Array.from(child.attributes).forEach((attr) => {
        if (!allowedAttrs.has(attr.name)) {
          child.removeAttribute(attr.name);
          return;
        }
        if (attr.name === 'href' && !isSafeHref(attr.value.trim())) {
          child.removeAttribute('href');
        }
      });
      if (tag === 'a') {
        if (!child.getAttribute('rel')) child.setAttribute('rel', 'noreferrer');
      }
      walk(child);
    });
  };
  walk(root);
  return root.innerHTML;
}

function formatPrice(value, currency) {
  if (value === null || value === undefined) return 'Custom';
  if (Number(value) === 0) return 'Free';
  const symbol = currency === 'EUR' ? '€' : '$';
  return `${symbol}${value}`;
}

function renderPricing(pricing = {}) {
  const wrap = qs('[data-pricing]');
  if (!wrap) return;
  const tiers = pricing.tiers || [];
  const currency = pricing.currency || 'USD';
  wrap.innerHTML = tiers.map((tier) => {
    const priceMonthly = formatPrice(tier.priceMonthly, currency);
    const priceAnnual = formatPrice(tier.priceAnnual, currency);
    const highlight = tier.highlight ? 'highlight' : '';
    const badge = tier.badge ? `<div class="badge">${tier.badge}</div>` : '';
    const features = (tier.features || []).map((f) => `<li>${f}</li>`).join('');
    return `
      <div class="pricing-card ${highlight}" data-price-monthly="${priceMonthly}" data-price-annual="${priceAnnual}">
        ${badge}
        <div>
          <div class="muted">${tier.name || ''}</div>
        <div class="price" data-price>${priceMonthly}</div>
        </div>
        <ul class="pricing-list">${features}</ul>
        <a class="btn ${tier.highlight ? 'primary' : 'ghost'}" href="${tier.ctaHref || '/register.html'}">${tier.ctaLabel || 'Get started'}</a>
      </div>
    `;
  }).join('');

  const note = qs('[data-billing-note]');
  if (note) note.textContent = pricing.billingNote || '';
}

function renderFaqs(faqs = []) {
  const wrap = qs('[data-faqs]');
  if (!wrap) return;
  wrap.innerHTML = faqs.map((f) => (
    `<div class="faq"><h4>${f.q || ''}</h4><p>${f.a || ''}</p></div>`
  )).join('');
}

function bindToggle() {
  const toggle = qs('[data-billing-toggle]');
  if (!toggle) return;
  const buttons = Array.from(toggle.querySelectorAll('button'));
  const cards = Array.from(document.querySelectorAll('[data-price-monthly]'));

  const apply = (mode) => {
    buttons.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === mode));
    cards.forEach((card) => {
      const price = card.dataset[`price${mode === 'annual' ? 'Annual' : 'Monthly'}`];
      const priceEl = card.querySelector('[data-price]');
      if (priceEl) {
        const needsUnit = price !== 'Custom' && price !== 'Free';
        const unit = needsUnit ? ` <span>/${mode === 'annual' ? 'month (annual)' : 'month'}</span>` : '';
        priceEl.innerHTML = `${price}${unit}`;
      }
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => apply(btn.dataset.mode));
  });

  apply('monthly');
}

async function init() {
  try {
    const config = await fetchConfig();
    setTextBind('brandName', config.brand?.name || 'OkLeaf');
    setTextBind('brandTagline', config.brand?.tagline || '');
    applyBrandLogo(config.brand || {});
    applyTheme(config.theme || {});
    renderNavLinks(config.nav?.links || []);
    renderNavCtas(config.nav?.ctas || {});
    renderLogos(config.logos || []);
    setText('heroHeadline', config.hero?.headline || '');
    setText('heroSub', config.hero?.subheadline || '');
    setHref('ctaPrimary', config.hero?.primaryCta?.href || '/register.html');
    setText('ctaPrimary', config.hero?.primaryCta?.label || 'Start free');
    setHref('ctaSecondary', config.hero?.secondaryCta?.href || '/contact.html');
    setText('ctaSecondary', config.hero?.secondaryCta?.label || 'Book a demo');

    renderStats(config.stats || []);
    renderFeatures(config.features || []);
    renderPricing(config.pricing || {});
    renderFaqs(config.faqs || []);

    setTextBind('footerCompany', config.footer?.company || 'OkLeaf');
    setTextBind('footerEmail', config.footer?.email || '');
    setTextBind('footerAddress', config.footer?.address || '');
    setTextSelector('[data-footer-heading-support]', config.footer?.headings?.support || '');
    setTextSelector('[data-footer-heading-company]', config.footer?.headings?.company || '');
    setTextSelector('[data-footer-heading-social]', config.footer?.headings?.social || '');
    renderFooterLinks(config.footer?.links || []);
    renderSocialLinks(config.footer?.social || []);

    if (config.meta?.title) document.title = config.meta.title;
    setMeta('meta[name="description"]', config.meta?.description);
    setMeta('meta[property="og:title"]', config.meta?.ogTitle || config.meta?.title);
    setMeta('meta[property="og:description"]', config.meta?.ogDescription || config.meta?.description);
    setMeta('meta[property="og:image"]', config.meta?.ogImage);

    const pageKey = document.body?.dataset?.page || '';
    if (pageKey && config.pages?.[pageKey]) {
      const page = config.pages[pageKey];
      const titleEl = qs('[data-page-title]');
      if (titleEl && page.title) titleEl.textContent = page.title;
      const subEl = qs('[data-page-subtitle]');
      if (subEl && page.subtitle) subEl.textContent = page.subtitle;
      if (page.hero?.headline) setText('heroHeadline', page.hero.headline);
      if (page.hero?.subheadline) setText('heroSub', page.hero.subheadline);
      if (page.hero?.primaryCta?.label) setText('ctaPrimary', page.hero.primaryCta.label);
      if (page.hero?.primaryCta?.href) setHref('ctaPrimary', page.hero.primaryCta.href);
      if (page.hero?.secondaryCta?.label) setText('ctaSecondary', page.hero.secondaryCta.label);
      if (page.hero?.secondaryCta?.href) setHref('ctaSecondary', page.hero.secondaryCta.href);
      const pageCtaPrimary = qs('[data-page-cta-primary]');
      if (pageCtaPrimary && page.ctaPrimary?.label) pageCtaPrimary.textContent = page.ctaPrimary.label;
      if (pageCtaPrimary && page.ctaPrimary?.href && pageCtaPrimary.tagName === 'A') {
        pageCtaPrimary.href = page.ctaPrimary.href;
      }
      const pageCtaSecondary = qs('[data-page-cta-secondary]');
      if (pageCtaSecondary && page.ctaSecondary?.label) pageCtaSecondary.textContent = page.ctaSecondary.label;
      if (pageCtaSecondary && page.ctaSecondary?.href && pageCtaSecondary.tagName === 'A') {
        pageCtaSecondary.href = page.ctaSecondary.href;
      }
      if (page.cards && pageKey === 'about') renderPageCards(page.cards, 'feature');
      if (page.cards && (pageKey === 'caseStudies' || pageKey === 'useCases')) renderPageCards(page.cards, 'case');
      if (pageKey === 'features') {
        const sectionTitle = qs('[data-page-section-title]');
        if (sectionTitle && page.section?.title) sectionTitle.textContent = page.section.title;
        const sectionSub = qs('[data-page-section-subtitle]');
        if (sectionSub && page.section?.subtitle) sectionSub.textContent = page.section.subtitle;
        if (page.cards) renderPageCards(page.cards, 'feature', '[data-page-cards]');
      }
      if (pageKey === 'pricing') {
        const monthly = qs('[data-pricing-monthly-label]');
        if (monthly && page.pricing?.monthlyLabel) monthly.textContent = page.pricing.monthlyLabel;
        const annual = qs('[data-pricing-annual-label]');
        if (annual && page.pricing?.annualLabel) annual.textContent = page.pricing.annualLabel;
        const faqTitle = qs('[data-page-faq-title]');
        if (faqTitle && page.pricing?.faqTitle) faqTitle.textContent = page.pricing.faqTitle;
        const faqSub = qs('[data-page-faq-subtitle]');
        if (faqSub && page.pricing?.faqSubtitle) faqSub.textContent = page.pricing.faqSubtitle;
      }
      if (pageKey === 'ecosystem') {
        const heroHeadline = qs('[data-ecosystem-hero-headline]');
        const heroSub = qs('[data-ecosystem-hero-sub]');
        const heroPrimary = qs('[data-ecosystem-hero-primary]');
        const heroSecondary = qs('[data-ecosystem-hero-secondary]');
        if (heroHeadline && (page.hero?.headline || page.title)) heroHeadline.textContent = page.hero?.headline || page.title;
        if (heroSub && (page.hero?.subheadline || page.subtitle)) heroSub.textContent = page.hero?.subheadline || page.subtitle;
        if (heroPrimary && page.hero?.primaryCta?.label) {
          heroPrimary.textContent = page.hero.primaryCta.label;
          if (page.hero.primaryCta.href) heroPrimary.href = page.hero.primaryCta.href;
        }
        if (heroSecondary && page.hero?.secondaryCta?.label) {
          heroSecondary.textContent = page.hero.secondaryCta.label;
          if (page.hero.secondaryCta.href) heroSecondary.href = page.hero.secondaryCta.href;
        }
        const callout = qs('[data-ecosystem-callout]');
        if (callout) {
          callout.innerHTML = page.callout ?? `<strong>${page.title}</strong><p class="muted">${page.subtitle}</p>`;
        }
        renderEcosystemFeatures(page.features || []);
        renderEcosystemInsights(page.insights || []);
        renderEcosystemTools(page.toolsList || []);
      }
      if (pageKey === 'docs') {
        const docsWrap = qs('[data-docs-html]');
        if (docsWrap && page.html) docsWrap.innerHTML = sanitizeDocsHtml(page.html);
      }
      if (pageKey === 'home') {
        const cardTitle = qs('[data-home-card-title]');
        if (cardTitle && page.homeCard?.title) cardTitle.textContent = page.homeCard.title;
        const badges = page.homeCard?.badges || (page.homeCard?.tag ? [page.homeCard.tag] : []);
        renderHomeBadges(badges);
        const cardLine = qs('[data-home-card-line]');
        if (cardLine && page.homeCard?.line) cardLine.textContent = page.homeCard.line;
        const primaryLabel = qs('[data-home-primary-label]');
        if (primaryLabel && page.homeCard?.primary?.label) primaryLabel.textContent = page.homeCard.primary.label;
        const primaryValue = qs('[data-home-primary-value]');
        if (primaryValue && page.homeCard?.primary?.value) primaryValue.textContent = page.homeCard.primary.value;
        const primarySub = qs('[data-home-primary-subtext]');
        if (primarySub && page.homeCard?.primary?.subtext) primarySub.textContent = page.homeCard.primary.subtext;
        const trendWrap = qs('[data-home-trend]');
        const trendLabel = trendWrap?.querySelector('.trend-label');
        const trendValue = trendWrap?.querySelector('.trend-value');
        if (trendLabel && page.homeCard?.trend?.label) trendLabel.textContent = page.homeCard.trend.label;
        if (trendValue && page.homeCard?.trend?.value) trendValue.textContent = page.homeCard.trend.value;
        if (trendWrap) {
          trendWrap.classList.remove('up', 'down', 'flat');
          trendWrap.classList.add(page.homeCard?.trend?.direction || 'up');
        }
        renderSparkline(page.homeCard?.sparkline || []);
        renderHomeCardMetrics(page.homeCard?.metrics || []);
      }
      if (pageKey === 'login' || pageKey === 'register') {
        renderAuthBullets(page.bullets || []);
      }
      if (page.body) renderPageBody(page.body);
      if (page.formSubmitLabel) {
        const btn = qs('[data-page-cta-primary]');
        if (btn) btn.textContent = page.formSubmitLabel;
      }
      if (page.formSuccess) {
        const notice = qs('#contactNotice');
        if (notice) notice.textContent = page.formSuccess;
      }
      const captcha = page.captcha || {};
      const captchaProvider = captcha.provider || page.captchaProvider || (captcha.question || page.captchaQuestion ? 'simple' : 'off');
      if (captchaProvider === 'simple') {
        const label = qs('[data-page-captcha-question]');
        const wrap = qs('#contactCaptchaWrap');
        if (label) label.textContent = captcha.question || page.captchaQuestion || '';
        if (wrap) {
          wrap.style.display = '';
          wrap.dataset.provider = 'simple';
          const widget = qs('#turnstileWidget');
          if (widget) widget.innerHTML = '';
          const answer = qs('#captchaAnswer');
          if (answer) answer.style.display = '';
          if (label) label.style.display = '';
        }
      } else if (captchaProvider === 'turnstile') {
        const wrap = qs('#contactCaptchaWrap');
        const widget = qs('#turnstileWidget');
        const siteKey = captcha.siteKey || '';
        if (wrap) {
          wrap.style.display = siteKey ? '' : 'none';
          wrap.dataset.provider = 'turnstile';
        }
        const label = qs('[data-page-captcha-question]');
        const answer = qs('#captchaAnswer');
        if (label) label.style.display = 'none';
        if (answer) answer.style.display = 'none';
        if (widget && siteKey) {
          widget.innerHTML = `<div class="cf-turnstile" data-sitekey="${siteKey}" data-theme="${captcha.theme || 'dark'}"></div>`;
          if (!document.querySelector('script[data-turnstile]')) {
            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
            script.async = true;
            script.defer = true;
            script.dataset.turnstile = '1';
            document.body.appendChild(script);
          }
        }
      } else {
        const wrap = qs('#contactCaptchaWrap');
        if (wrap) {
          wrap.style.display = 'none';
          wrap.dataset.provider = 'off';
        }
      }
      if (page.meta) {
        if (page.meta.title) document.title = page.meta.title;
        setMeta('meta[name="description"]', page.meta.description || '');
        setMeta('meta[property="og:title"]', page.meta.ogTitle || page.meta.title || '');
        setMeta('meta[property="og:description"]', page.meta.ogDescription || page.meta.description || '');
        setMeta('meta[property="og:image"]', page.meta.ogImage || '');
      }
      if (Array.isArray(page.faqs)) renderFaqs(page.faqs);
    }

    bindToggle();
  } catch (err) {
    console.error('site init error', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

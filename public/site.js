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
  if (!nav || !links.length) return;
  nav.innerHTML = links.map((link) => (
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

function renderSocialLinks(links = []) {
  const wrap = qs('[data-social-links]');
  if (!wrap || !links.length) return;
  wrap.innerHTML = links.map((link) => (
    `<a href="${link.href || '#'}" target="_blank" rel="noreferrer">${link.label || ''}</a>`
  )).join('');
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
    renderFooterLinks(config.footer?.links || []);
    renderSocialLinks(config.footer?.social || []);

    if (config.meta?.title) document.title = config.meta.title;
    setMeta('meta[name="description"]', config.meta?.description);
    setMeta('meta[property="og:title"]', config.meta?.ogTitle || config.meta?.title);
    setMeta('meta[property="og:description"]', config.meta?.ogDescription || config.meta?.description);
    setMeta('meta[property="og:image"]', config.meta?.ogImage);

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

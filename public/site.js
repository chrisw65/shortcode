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

function setHref(id, value) {
  const el = byId(id);
  if (el && value) el.href = value;
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
    setText('brandName', config.brand?.name || 'OkLeaf');
    setText('brandTagline', config.brand?.tagline || '');
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

    setText('footerCompany', config.footer?.company || 'OkLeaf');
    setText('footerEmail', config.footer?.email || '');
    setText('footerAddress', config.footer?.address || '');

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

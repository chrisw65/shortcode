import { requireAuth, apiFetch, showError, showToast, htmlesc } from '/admin/admin-common.js?v=20260120';

requireAuth();

const couponCode = document.getElementById('couponCode');
const couponPlan = document.getElementById('couponPlan');
const couponDuration = document.getElementById('couponDuration');
const couponPercent = document.getElementById('couponPercent');
const couponMax = document.getElementById('couponMax');
const couponExpires = document.getElementById('couponExpires');
const createCoupon = document.getElementById('createCoupon');
const couponMsg = document.getElementById('couponMsg');
const refreshCoupons = document.getElementById('refreshCoupons');
const couponsBody = document.getElementById('couponsBody');

const grantType = document.getElementById('grantType');
const grantTarget = document.getElementById('grantTarget');
const grantPlan = document.getElementById('grantPlan');
const grantDuration = document.getElementById('grantDuration');
const grantReason = document.getElementById('grantReason');
const createGrant = document.getElementById('createGrant');
const grantMsg = document.getElementById('grantMsg');
const refreshGrants = document.getElementById('refreshGrants');
const grantsBody = document.getElementById('grantsBody');

const billingInterval = document.getElementById('billingInterval');
const planList = document.getElementById('planList');
const currentPlan = document.getElementById('currentPlan');
const billingMsg = document.getElementById('billingMsg');
const manageBilling = document.getElementById('manageBilling');
const entitlementsSection = document.getElementById('entitlementsSection');
const entitlementsGrid = document.getElementById('entitlementsGrid');
const entitlementsMsg = document.getElementById('entitlementsMsg');
const saveEntitlements = document.getElementById('saveEntitlements');
const entitlementsPlanSelect = document.getElementById('entitlementsPlanSelect');

const stripeConfigSection = document.getElementById('stripeConfigSection');
const stripePublishable = document.getElementById('stripePublishable');
const stripeSecret = document.getElementById('stripeSecret');
const stripeWebhook = document.getElementById('stripeWebhook');
const stripeSuccessUrl = document.getElementById('stripeSuccessUrl');
const stripeCancelUrl = document.getElementById('stripeCancelUrl');
const stripeReturnUrl = document.getElementById('stripeReturnUrl');
const stripeSecretHint = document.getElementById('stripeSecretHint');
const stripeWebhookHint = document.getElementById('stripeWebhookHint');
const saveStripeConfig = document.getElementById('saveStripeConfig');
const stripeConfigMsg = document.getElementById('stripeConfigMsg');

const planMappingSection = document.getElementById('planMappingSection');
const planMapBody = document.getElementById('planMapBody');
const savePlanMapping = document.getElementById('savePlanMapping');
const planMapMsg = document.getElementById('planMapMsg');
const reloadPlanMapping = document.getElementById('reloadPlanMapping');

const platformDefaultsSection = document.getElementById('platformDefaultsSection');
const platformRetentionDays = document.getElementById('platformRetentionDays');
const savePlatformDefaults = document.getElementById('savePlatformDefaults');
const platformDefaultsMsg = document.getElementById('platformDefaultsMsg');

let pricingTiers = [];
let billingConfig = { prices: {}, stripe: {} };
let platformConfig = {};
let meData = null;
let selectedEntitlementsPlan = '';
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
const entitlementsTabBtn = document.querySelector('.tab-btn[data-tab="entitlements"]');

function activateTab(tabName = 'plan') {
  tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  tabPanels.forEach((panel) => {
    const show = panel.dataset.panel === tabName;
    panel.style.display = show ? 'block' : 'none';
  });
}
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab || 'plan'));
});
activateTab('plan');

const FEATURE_KEYS = [
  { key: 'custom_domains', label: 'Custom domains' },
  { key: 'api_keys', label: 'API keys' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'bulk_links', label: 'Bulk actions' },
  { key: 'variants', label: 'Variants (A/B)' },
  { key: 'routes', label: 'Smart routes' },
  { key: 'deep_links', label: 'Deep links' },
  { key: 'tags', label: 'Tags' },
  { key: 'groups', label: 'Groups' },
];

const LIMIT_KEYS = [
  { key: 'links', label: 'Link limit' },
  { key: 'domains', label: 'Domain limit' },
  { key: 'team_seats', label: 'Team seats' },
  { key: 'retention_days', label: 'Retention days' },
  { key: 'api_rate_rpm', label: 'API rpm limit' },
];

const LIMIT_LABELS = {
  links: 'links',
  domains: 'custom domains',
  team_seats: 'team seats',
  retention_days: 'days retention',
  api_rate_rpm: 'API rpm',
};

const DEFAULT_ENTITLEMENTS = {
  free: {
    features: {
      custom_domains: false,
      api_keys: false,
      webhooks: false,
      integrations: false,
      bulk_links: false,
      variants: false,
      routes: false,
      deep_links: false,
      tags: false,
      groups: false,
    },
    limits: { links: 10, domains: 0, team_seats: 1, retention_days: 7, api_rate_rpm: 120 },
  },
  starter: {
    features: {
      custom_domains: true,
      api_keys: true,
      webhooks: true,
      integrations: true,
      bulk_links: true,
      variants: false,
      routes: false,
      deep_links: false,
      tags: true,
      groups: true,
    },
    limits: { links: 1000, domains: 1, team_seats: 3, retention_days: 30, api_rate_rpm: 600 },
  },
  pro: {
    features: {
      custom_domains: true,
      api_keys: true,
      webhooks: true,
      integrations: true,
      bulk_links: true,
      variants: true,
      routes: true,
      deep_links: true,
      tags: true,
      groups: true,
    },
    limits: { links: 10000, domains: 5, team_seats: 10, retention_days: 365, api_rate_rpm: 2000 },
  },
  enterprise: {
    features: {
      custom_domains: true,
      api_keys: true,
      webhooks: true,
      integrations: true,
      bulk_links: true,
      variants: true,
      routes: true,
      deep_links: true,
      tags: true,
      groups: true,
    },
    limits: { links: null, domains: null, team_seats: null, retention_days: null, api_rate_rpm: null },
  },
};

function defaultEntitlementsForPlan(planId) {
  return DEFAULT_ENTITLEMENTS[planId] || DEFAULT_ENTITLEMENTS.free;
}

function formatLimitLine(key, value) {
  if (value === null) {
    if (key === 'retention_days') return 'Unlimited retention';
    if (key === 'api_rate_rpm') return 'Unlimited API rate';
    return `Unlimited ${LIMIT_LABELS[key] || key}`;
  }
  if (value === 0 && key === 'domains') return 'No custom domains';
  if (key === 'team_seats') return value === 1 ? '1 team seat' : `Up to ${value} team seats`;
  if (key === 'retention_days') return `Retention: ${value} days`;
  if (key === 'api_rate_rpm') return `API rate: ${value} rpm`;
  return `Up to ${value} ${LIMIT_LABELS[key] || key}`;
}

function buildFeatureList(planId) {
  const entitlements = billingConfig.entitlements || {};
  const baseline = defaultEntitlementsForPlan(planId);
  const override = entitlements[planId] || {};
  const features = { ...baseline.features, ...(override.features || {}) };
  const limits = { ...baseline.limits, ...(override.limits || {}) };
  const list = [];
  FEATURE_KEYS.forEach((f) => {
    if (features[f.key]) list.push(f.label);
  });
  LIMIT_KEYS.forEach((l) => {
    const value = limits[l.key];
    if (value === undefined) return;
    if (value === 0 && l.key !== 'domains') return;
    list.push(formatLimitLine(l.key, value));
  });
  return list;
}

async function syncPricingFeaturesToPublic() {
  try {
    const res = await apiFetch('/api/site-config');
    const draft = res?.data?.draft || {};
    const pricing = draft.pricing || {};
    const tiers = Array.isArray(pricing.tiers) ? pricing.tiers : [];
    const updated = tiers.map((tier) => {
      const planId = planIdForTier(tier);
      return { ...tier, features: buildFeatureList(planId) };
    });
    const nextDraft = { ...draft, pricing: { ...pricing, tiers: updated } };
    await apiFetch('/api/site-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextDraft),
    });
    await apiFetch('/api/site-config/publish', { method: 'POST' });
    pricingTiers = updated;
    renderPlanCards();
  } catch (err) {
    console.warn('Failed to sync pricing features', err);
  }
}

function renderEntitlementsPlanSelector() {
  if (!entitlementsPlanSelect) return;
  entitlementsPlanSelect.innerHTML = '';
  if (!pricingTiers.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No plans';
    entitlementsPlanSelect.appendChild(opt);
    entitlementsPlanSelect.disabled = true;
    return;
  }
  entitlementsPlanSelect.disabled = false;
  pricingTiers.forEach((tier) => {
    const planId = planIdForTier(tier);
    const opt = document.createElement('option');
    opt.value = planId;
    opt.textContent = tier.name || planId;
    entitlementsPlanSelect.appendChild(opt);
  });
  const fallbackPlan = planIdForTier(pricingTiers[0]);
  if (!selectedEntitlementsPlan || !pricingTiers.some((tier) => planIdForTier(tier) === selectedEntitlementsPlan)) {
    selectedEntitlementsPlan = fallbackPlan;
  }
  entitlementsPlanSelect.value = selectedEntitlementsPlan;
}

async function loadMe() {
  try {
    const res = await apiFetch('/api/auth/me');
    meData = res.data || null;
    if (currentPlan) {
      const plan = meData?.effective_plan || meData?.user?.plan || 'free';
      currentPlan.textContent = `Current plan: ${plan}`;
    }
    if (meData?.user?.is_superadmin) {
      stripeConfigSection.style.display = 'block';
      planMappingSection.style.display = 'block';
      platformDefaultsSection.style.display = 'block';
      if (entitlementsSection) entitlementsSection.style.display = 'block';
      if (entitlementsTabBtn) entitlementsTabBtn.style.display = '';
    } else {
      if (entitlementsSection) entitlementsSection.style.display = 'none';
      if (entitlementsTabBtn) entitlementsTabBtn.style.display = 'none';
    }
  } catch (err) {
    console.error('Failed to load user profile', err);
  }
}

async function loadPricing() {
  try {
    const res = await fetch('/api/public/site-config');
    const data = await res.json();
    const pricing = data?.data?.pricing || {};
    pricingTiers = Array.isArray(pricing.tiers) ? pricing.tiers : [];
    renderPlanCards(pricing);
    renderPlanMapping();
    renderEntitlements();
  } catch (err) {
    planList.innerHTML = '<div class="muted">Failed to load pricing.</div>';
  }
}

async function loadBillingConfig() {
  if (!meData?.user?.is_superadmin) return;
  try {
    const res = await apiFetch('/api/billing/config');
    billingConfig = res.data || { prices: {}, stripe: {} };
    if (stripePublishable) stripePublishable.value = billingConfig.stripe?.publishable_key || '';
    if (stripeSuccessUrl) stripeSuccessUrl.value = billingConfig.checkout?.success_url || '';
    if (stripeCancelUrl) stripeCancelUrl.value = billingConfig.checkout?.cancel_url || '';
    if (stripeReturnUrl) stripeReturnUrl.value = billingConfig.portal?.return_url || '';
    if (stripeSecretHint) {
      stripeSecretHint.textContent = billingConfig.stripe?.has_secret_key ? 'Secret key is set.' : 'Secret key not set.';
    }
    if (stripeWebhookHint) {
      stripeWebhookHint.textContent = billingConfig.stripe?.has_webhook_secret ? 'Webhook secret is set.' : 'Webhook secret not set.';
    }
    renderPlanMapping();
    renderPlanCards();
    renderEntitlements();
  } catch (err) {
    stripeConfigMsg.textContent = 'Failed to load Stripe config.';
  }
}

async function loadPlatformConfig() {
  if (!meData?.user?.is_superadmin) return;
  try {
    const res = await apiFetch('/api/platform-config');
    platformConfig = res.data || {};
    if (platformRetentionDays) {
      platformRetentionDays.value = platformConfig.retention_default_days ? String(platformConfig.retention_default_days) : '';
    }
  } catch (err) {
    if (platformDefaultsMsg) platformDefaultsMsg.textContent = 'Failed to load platform defaults.';
  }
}

function formatPrice(tier, interval, currency) {
  const value = interval === 'annual' ? tier.priceAnnual : tier.priceMonthly;
  if (value === null || value === undefined || value === '') return 'Custom';
  if (Number(value) === 0) return 'Free';
  const amount = Number(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function planIdForTier(tier) {
  if (tier.id) return tier.id;
  return (tier.name || 'plan')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function renderPlanCards(pricing) {
  if (!planList) return;
  const cfg = pricing || {};
  const currency = cfg.currency || 'USD';
  const interval = billingInterval?.value || 'monthly';
  if (!pricingTiers.length) {
    planList.innerHTML = '<div class="muted">No pricing tiers configured.</div>';
    return;
  }
  planList.innerHTML = '';
  pricingTiers.forEach((tier) => {
    const planId = planIdForTier(tier);
    const priceText = formatPrice(tier, interval, currency);
    const priceMap = billingConfig.prices || {};
    const priceId = priceMap?.[planId]?.[interval] || '';
    const isCurrent = (meData?.effective_plan || meData?.user?.plan || 'free') === planId;
    const canCheckout = Boolean(priceId);
    const features = (tier.features || []).map((f) => `<li>${htmlesc(f)}</li>`).join('');
    const card = document.createElement('div');
    card.className = 'plan-card';
    card.innerHTML = `
      <div class="plan-title">${htmlesc(tier.name || tier.id)}</div>
      <div class="plan-price">${priceText}</div>
      <div class="plan-note">${interval === 'annual' ? 'Billed annually' : 'Billed monthly'}</div>
      <ul>${features}</ul>
      <button class="btn" ${!canCheckout || isCurrent || priceText === 'Custom' ? 'disabled' : ''}>
        ${isCurrent ? 'Current plan' : 'Upgrade'}
      </button>
    `;
    const btn = card.querySelector('button');
    if (btn && canCheckout && !isCurrent && priceText !== 'Custom') {
      btn.addEventListener('click', () => startCheckout(planId, interval));
    }
    planList.appendChild(card);
  });
}

function renderPlanMapping() {
  if (!planMapBody || !meData?.user?.is_superadmin) return;
  const priceMap = billingConfig.prices || {};
  planMapBody.innerHTML = '';
  if (!pricingTiers.length) {
    planMapBody.innerHTML = '<tr><td colspan="4" class="muted">No tiers found.</td></tr>';
    return;
  }
  pricingTiers.forEach((tier) => {
    const planId = planIdForTier(tier);
    const tr = document.createElement('tr');
    const monthly = priceMap?.[planId]?.monthly || '';
    const annual = priceMap?.[planId]?.annual || '';
    tr.innerHTML = `
      <td>${htmlesc(planId)}</td>
      <td>${htmlesc(tier.name || '')}</td>
      <td><input class="input price-monthly" data-plan="${htmlesc(planId)}" value="${htmlesc(monthly)}" placeholder="price_..."></td>
      <td><input class="input price-annual" data-plan="${htmlesc(planId)}" value="${htmlesc(annual)}" placeholder="price_..."></td>
    `;
    planMapBody.appendChild(tr);
  });
}

function renderEntitlements() {
  if (!entitlementsGrid || !meData?.user?.is_superadmin) return;
  if (!pricingTiers.length) {
    entitlementsGrid.innerHTML = '<div class="muted">No plan tiers available.</div>';
    return;
  }
  renderEntitlementsPlanSelector();
  const entitlements = billingConfig.entitlements || {};
  entitlementsGrid.innerHTML = '';
  const planId = selectedEntitlementsPlan || planIdForTier(pricingTiers[0]);
  const tier = pricingTiers.find((t) => planIdForTier(t) === planId) || pricingTiers[0];
  const baseline = defaultEntitlementsForPlan(planId);
  const override = entitlements[planId] || {};
  const features = { ...baseline.features, ...(override.features || {}) };
  const limits = { ...baseline.limits, ...(override.limits || {}) };
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <h4 style="margin-bottom:8px">${htmlesc(tier?.name || planId)}</h4>
    <div class="grid grid-2">
      ${FEATURE_KEYS.map((f) => `
        <label class="muted small">
          <input type="checkbox" data-plan="${htmlesc(planId)}" data-feature="${f.key}" ${features[f.key] ? 'checked' : ''}>
          ${htmlesc(f.label)}
        </label>
      `).join('')}
    </div>
    <div class="grid grid-2" style="margin-top:10px">
      ${LIMIT_KEYS.map((l) => `
        <label class="muted small">
          ${htmlesc(l.label)}
          <input class="input" data-plan="${htmlesc(planId)}" data-limit="${l.key}" value="${limits[l.key] ?? ''}" placeholder="Leave empty for unlimited">
        </label>
      `).join('')}
    </div>
  `;
  entitlementsGrid.appendChild(card);
}

function gatherEntitlements() {
  const entitlements = { ...(billingConfig.entitlements || {}) };
  if (!entitlementsGrid) return entitlements;
  const planId = selectedEntitlementsPlan || (pricingTiers[0] ? planIdForTier(pricingTiers[0]) : '');
  if (!planId) return entitlements;
  const features = {};
  FEATURE_KEYS.forEach((f) => {
    const input = entitlementsGrid.querySelector(`[data-plan="${planId}"][data-feature="${f.key}"]`);
    features[f.key] = Boolean(input?.checked);
  });
  const limits = {};
  LIMIT_KEYS.forEach((l) => {
    const input = entitlementsGrid.querySelector(`[data-plan="${planId}"][data-limit="${l.key}"]`);
    const raw = input?.value.trim() || '';
    limits[l.key] = raw ? Number(raw) : null;
  });
  entitlements[planId] = { features, limits };
  return entitlements;
}

async function startCheckout(planId, interval) {
  billingMsg.textContent = '';
  try {
    const res = await apiFetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: planId, interval }),
    });
    const url = res?.data?.url;
    if (url) window.location.href = url;
    else billingMsg.textContent = 'Checkout session unavailable.';
  } catch (err) {
    showError(err, 'Failed to start checkout');
  }
}

async function openPortal() {
  billingMsg.textContent = '';
  try {
    const res = await apiFetch('/api/billing/portal', { method: 'POST' });
    const url = res?.data?.url;
    if (url) window.location.href = url;
    else billingMsg.textContent = 'Billing portal unavailable.';
  } catch (err) {
    showError(err, 'Failed to open billing portal');
  }
}

if (saveEntitlements) {
  saveEntitlements.addEventListener('click', async () => {
    if (!meData?.user?.is_superadmin) return;
    entitlementsMsg.textContent = '';
    const entitlements = gatherEntitlements();
    try {
      const res = await apiFetch('/api/billing/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entitlements }),
      });
      billingConfig = res.data || billingConfig;
      renderEntitlements();
      await syncPricingFeaturesToPublic();
      entitlementsMsg.textContent = 'Entitlements saved.';
    } catch (err) {
      entitlementsMsg.textContent = 'Failed to save entitlements.';
      showError(err, 'Failed to save entitlements');
    }
  });
}

entitlementsPlanSelect?.addEventListener('change', () => {
  selectedEntitlementsPlan = entitlementsPlanSelect.value;
  renderEntitlements();
});

async function savePlatformDefaultsHandler() {
  if (!meData?.user?.is_superadmin) return;
  if (platformDefaultsMsg) platformDefaultsMsg.textContent = '';
  const raw = platformRetentionDays ? platformRetentionDays.value.trim() : '';
  const value = raw ? Number(raw) : null;
  if (raw && (!Number.isInteger(value) || value < 1 || value > 3650)) {
    if (platformDefaultsMsg) platformDefaultsMsg.textContent = 'Retention must be 1-3650 days.';
    return;
  }
  try {
    await apiFetch('/api/platform-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retention_default_days: raw ? value : null }),
    });
    if (platformDefaultsMsg) platformDefaultsMsg.textContent = 'Platform defaults saved.';
  } catch (err) {
    showError(err, 'Failed to save platform defaults');
  }
}

async function loadCoupons() {
  try {
    const res = await apiFetch('/api/coupons');
    const list = res.data || [];
    couponsBody.innerHTML = '';
    if (!list.length) {
      couponsBody.innerHTML = '<tr><td colspan="7" class="muted">No coupons.</td></tr>';
      return;
    }
    list.forEach((c) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.code}</td>
        <td>${c.plan}</td>
        <td>${c.duration_months}</td>
        <td>${c.percent_off ?? '-'}</td>
        <td>${c.max_redemptions ?? '-'}</td>
        <td>${c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '-'}</td>
        <td>${c.active ? 'active' : 'inactive'}</td>
      `;
      couponsBody.appendChild(tr);
    });
  } catch (err) {
    couponsBody.innerHTML = '<tr><td colspan="7" class="muted">Failed to load.</td></tr>';
  }
}

async function loadGrants() {
  try {
    const res = await apiFetch('/api/plan-grants');
    const list = res.data || [];
    grantsBody.innerHTML = '';
    if (!list.length) {
      grantsBody.innerHTML = '<tr><td colspan="5" class="muted">No grants.</td></tr>';
      return;
    }
    list.forEach((g) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${g.target_type} ${g.target_id}</td>
        <td>${g.plan}</td>
        <td>${g.starts_at ? new Date(g.starts_at).toLocaleDateString() : '-'}</td>
        <td>${g.ends_at ? new Date(g.ends_at).toLocaleDateString() : '-'}</td>
        <td>${g.reason || '-'}</td>
      `;
      grantsBody.appendChild(tr);
    });
  } catch (err) {
    grantsBody.innerHTML = '<tr><td colspan="5" class="muted">Failed to load.</td></tr>';
  }
}

async function createCouponHandler() {
  couponMsg.textContent = '';
  const payload = {
    code: couponCode.value.trim(),
    plan: couponPlan.value.trim(),
    duration_months: Number(couponDuration.value || 1),
    percent_off: couponPercent.value ? Number(couponPercent.value) : null,
    max_redemptions: couponMax.value ? Number(couponMax.value) : null,
    expires_at: couponExpires.value ? `${couponExpires.value}T00:00:00Z` : null,
  };
  if (!payload.code || !payload.plan) {
    couponMsg.textContent = 'Code and plan are required.';
    return;
  }
  createCoupon.disabled = true;
  try {
    await apiFetch('/api/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    showToast('Coupon created');
    couponCode.value = '';
    couponPlan.value = '';
    couponPercent.value = '';
    couponMax.value = '';
    couponExpires.value = '';
    await loadCoupons();
  } catch (err) {
    showError(err, 'Failed to create coupon');
  } finally {
    createCoupon.disabled = false;
  }
}

async function createGrantHandler() {
  grantMsg.textContent = '';
  const payload = {
    target_type: grantType.value,
    target_id: grantTarget.value.trim(),
    plan: grantPlan.value.trim(),
    duration_months: Number(grantDuration.value || 1),
    reason: grantReason.value.trim(),
  };
  if (!payload.target_id || !payload.plan) {
    grantMsg.textContent = 'Target ID and plan are required.';
    return;
  }
  createGrant.disabled = true;
  try {
    await apiFetch('/api/plan-grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    showToast('Plan grant created');
    grantTarget.value = '';
    grantPlan.value = '';
    grantReason.value = '';
    await loadGrants();
  } catch (err) {
    showError(err, 'Failed to create grant');
  } finally {
    createGrant.disabled = false;
  }
}

createCoupon?.addEventListener('click', createCouponHandler);
refreshCoupons?.addEventListener('click', loadCoupons);
createGrant?.addEventListener('click', createGrantHandler);
refreshGrants?.addEventListener('click', loadGrants);
billingInterval?.addEventListener('change', () => renderPlanCards());
manageBilling?.addEventListener('click', openPortal);
reloadPlanMapping?.addEventListener('click', () => {
  renderPlanMapping();
  renderPlanCards();
});
saveStripeConfig?.addEventListener('click', async () => {
  stripeConfigMsg.textContent = '';
  saveStripeConfig.disabled = true;
  try {
    const payload = {
      stripe: {
        publishable_key: stripePublishable.value.trim(),
        secret_key: stripeSecret.value.trim(),
        webhook_secret: stripeWebhook.value.trim(),
      },
      checkout: {
        success_url: stripeSuccessUrl.value.trim(),
        cancel_url: stripeCancelUrl.value.trim(),
      },
      portal: {
        return_url: stripeReturnUrl.value.trim(),
      },
    };
    const res = await apiFetch('/api/billing/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    billingConfig = res.data || billingConfig;
    stripeSecret.value = '';
    stripeWebhook.value = '';
    stripeConfigMsg.textContent = 'Stripe settings saved.';
    await loadBillingConfig();
  } catch (err) {
    showError(err, 'Failed to save Stripe settings');
  } finally {
    saveStripeConfig.disabled = false;
  }
});
savePlanMapping?.addEventListener('click', async () => {
  planMapMsg.textContent = '';
  savePlanMapping.disabled = true;
  try {
    const mapping = {};
    planMapBody.querySelectorAll('tr').forEach((tr) => {
      const monthly = tr.querySelector('.price-monthly');
      const annual = tr.querySelector('.price-annual');
      if (!monthly || !annual) return;
      const planId = monthly.dataset.plan;
      if (!planId) return;
      mapping[planId] = {
        monthly: monthly.value.trim(),
        annual: annual.value.trim(),
      };
    });
    const res = await apiFetch('/api/billing/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prices: mapping }),
    });
    billingConfig = res.data || billingConfig;
    planMapMsg.textContent = 'Price mapping saved.';
    renderPlanCards();
  } catch (err) {
    showError(err, 'Failed to save price mapping');
  } finally {
    savePlanMapping.disabled = false;
  }
});

savePlatformDefaults?.addEventListener('click', savePlatformDefaultsHandler);

await loadMe();
await loadPricing();
await loadBillingConfig();
await loadPlatformConfig();
loadCoupons();
loadGrants();

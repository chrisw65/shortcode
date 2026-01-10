import { requireAuth, apiFetch, showError, showToast, htmlesc } from '/admin/admin-common.js?v=20260112';

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

import { requireAuth, apiFetch, showError, showToast } from '/admin/admin-common.js';

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

loadCoupons();
loadGrants();

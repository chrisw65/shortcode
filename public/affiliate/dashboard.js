const token = localStorage.getItem('affiliate_token') || '';
const couponPlan = document.getElementById('couponPlan');
const couponPercent = document.getElementById('couponPercent');
const couponDuration = document.getElementById('couponDuration');
const couponMaxRedemptions = document.getElementById('couponMaxRedemptions');
const couponCode = document.getElementById('couponCode');
const couponCreate = document.getElementById('couponCreate');
const couponMsg = document.getElementById('couponMsg');
const couponTable = document.getElementById('couponTable');

let affiliateConfig = null;

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '-';
}

async function api(path, options = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (options.headers) Object.assign(headers, options.headers);
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch((err) => { console.warn('Failed to parse JSON response', err); return null; });
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data.data || {};
}

async function loadAffiliate() {
  try {
    const info = await api('/api/affiliate/me');
    setText('affStatus', info.status || 'active');
    const link = `${window.location.origin}/register.html?aff=${info.code || 'CODE'}`;
    const linkEl = document.getElementById('affLink');
    if (linkEl) linkEl.textContent = link;
  } catch (err) {
    console.error(err);
  }
}

async function loadSummary() {
  try {
    const summary = await api('/api/affiliate/summary');
    setText('affConversions', summary.conversions || 0);
    setText('affTotal', summary.total_amount || 0);
    setText('affTotalPayout', summary.total_payout || 0);
    setText('affPending', summary.pending_amount || 0);
    setText('affPoints', summary.active_points || 0);
  } catch (err) {
    console.error(err);
  }
}

async function loadActivity() {
  const panel = document.getElementById('affActivity');
  try {
    const conversions = await api('/api/affiliate/conversions');
    if (!conversions.length) {
      panel.innerHTML = '<p>No conversions yet.</p>';
      return;
    }
    panel.innerHTML = conversions.slice(0, 5).map((c) => {
      const when = new Date(c.created_at).toLocaleDateString();
      const label = c.event_type === 'paid' ? 'Paid conversion' : 'Signup';
      const amount = c.net_amount || c.amount || 0;
      return `<p>${when} - ${label} (${c.status}) - $${amount}</p>`;
    }).join('');
  } catch (err) {
    panel.innerHTML = '<p>Unable to load activity.</p>';
  }
}

async function loadPayouts() {
  const body = document.getElementById('affPayouts');
  try {
    const payouts = await api('/api/affiliate/payouts');
    if (!payouts.length) {
      body.innerHTML = '<tr><td colspan="3">No payouts yet.</td></tr>';
      return;
    }
    body.innerHTML = payouts.slice(0, 10).map((p) => {
      const period = `${p.period_start} - ${p.period_end}`;
      return `<tr><td>${period}</td><td>$${p.amount}</td><td>${p.status}</td></tr>`;
    }).join('');
  } catch (err) {
    body.innerHTML = '<tr><td colspan="3">Unable to load payouts.</td></tr>';
  }
}

async function loadAffiliateConfig() {
  try {
    affiliateConfig = await api('/api/affiliate/config');
    if (!affiliateConfig) return;
    if (couponPercent) couponPercent.value = affiliateConfig.coupon_max_percent_off || 10;
    if (couponDuration) couponDuration.value = 1;
    if (couponMaxRedemptions) couponMaxRedemptions.value = affiliateConfig.coupon_default_max_redemptions || 100;
  } catch (err) {
    console.warn('Failed to load affiliate config', err);
  }
}

async function loadCoupons() {
  try {
    const coupons = await api('/api/affiliate/coupons');
    if (!couponTable) return;
    if (!coupons.length) {
      couponTable.innerHTML = '<tr><td colspan="4">No coupons yet.</td></tr>';
      return;
    }
    couponTable.innerHTML = coupons.slice(0, 20).map((c) => {
      return `<tr>
        <td><code>${c.code}</code></td>
        <td>${c.plan}</td>
        <td>${c.percent_off || 0}%</td>
        <td>${c.duration_months} mo</td>
      </tr>`;
    }).join('');
  } catch (err) {
    if (couponTable) {
      couponTable.innerHTML = '<tr><td colspan="4">Unable to load coupons.</td></tr>';
    }
  }
}

async function createCoupon() {
  if (!couponMsg) return;
  couponMsg.textContent = '';
  const payload = {
    plan: couponPlan?.value.trim(),
    percent_off: Number(couponPercent?.value || 0),
    duration_months: Number(couponDuration?.value || 0),
    max_redemptions: Number(couponMaxRedemptions?.value || 0),
    code: couponCode?.value.trim(),
  };
  if (!payload.plan) {
    couponMsg.textContent = 'Plan is required.';
    return;
  }
  couponCreate.disabled = true;
  try {
    const res = await api('/api/affiliate/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    couponMsg.textContent = `Coupon created: ${res.code}`;
    couponCode.value = '';
    await loadCoupons();
  } catch (err) {
    couponMsg.textContent = err.message || 'Failed to create coupon.';
  } finally {
    couponCreate.disabled = false;
  }
}

if (!token) {
  window.location.href = '/affiliate/login.html';
} else {
  loadAffiliateConfig();
  loadAffiliate();
  loadSummary();
  loadActivity();
  loadPayouts();
  loadCoupons();
  couponCreate?.addEventListener('click', createCoupon);
}

import { requireAuth, apiFetch, showError, showToast } from '/admin/admin-common.js?v=20260120';

requireAuth();

const affName = document.getElementById('affName');
const affEmail = document.getElementById('affEmail');
const affCompany = document.getElementById('affCompany');
const affPayoutType = document.getElementById('affPayoutType');
const affPayoutRate = document.getElementById('affPayoutRate');
const affCreate = document.getElementById('affCreate');
const affMsg = document.getElementById('affMsg');
const affRefresh = document.getElementById('affRefresh');
const affiliatesBody = document.getElementById('affiliatesBody');
const payoutsBody = document.getElementById('payoutsBody');
const payoutRefresh = document.getElementById('payoutRefresh');
const exportPayouts = document.getElementById('exportPayouts');
const saveAffiliateConfig = document.getElementById('saveAffiliateConfig');
const affiliateConfigMsg = document.getElementById('affiliateConfigMsg');
const affiliateDefaultPayoutType = document.getElementById('affiliateDefaultPayoutType');
const affiliateDefaultPayoutRate = document.getElementById('affiliateDefaultPayoutRate');
const affiliateHoldDays = document.getElementById('affiliateHoldDays');
const affiliateSignupPoints = document.getElementById('affiliateSignupPoints');
const affiliatePointsExpiry = document.getElementById('affiliatePointsExpiry');
const affiliateCouponsEnabled = document.getElementById('affiliateCouponsEnabled');
const affiliateCouponMaxPercent = document.getElementById('affiliateCouponMaxPercent');
const affiliateCouponMaxDuration = document.getElementById('affiliateCouponMaxDuration');
const affiliateCouponMaxRedemptions = document.getElementById('affiliateCouponMaxRedemptions');

let affiliateDefaults = null;

async function loadAffiliateConfig() {
  try {
    const res = await apiFetch('/api/affiliates/config');
    affiliateDefaults = res.data || {};
    if (!affiliateDefaults) return;
    affiliateDefaultPayoutType.value = affiliateDefaults.default_payout_type || 'percent';
    affiliateDefaultPayoutRate.value = affiliateDefaults.default_payout_rate ?? 30;
    affiliateHoldDays.value = affiliateDefaults.payout_hold_days ?? 14;
    affiliateSignupPoints.value = affiliateDefaults.free_signup_points ?? 1;
    affiliatePointsExpiry.value = affiliateDefaults.free_signup_points_expiry_days ?? 180;
    affiliateCouponsEnabled.value = affiliateDefaults.allow_affiliate_coupons ? 'true' : 'false';
    affiliateCouponMaxPercent.value = affiliateDefaults.coupon_max_percent_off ?? 30;
    affiliateCouponMaxDuration.value = affiliateDefaults.coupon_max_duration_months ?? 3;
    affiliateCouponMaxRedemptions.value = affiliateDefaults.coupon_default_max_redemptions ?? 100;
    affPayoutType.value = affiliateDefaults.default_payout_type || 'percent';
    affPayoutRate.value = affiliateDefaults.default_payout_rate ?? 30;
  } catch (err) {
    affiliateConfigMsg.textContent = 'Failed to load defaults.';
  }
}

async function loadAffiliates() {
  try {
    const res = await apiFetch('/api/affiliates');
    const list = res.data || [];
    affiliatesBody.innerHTML = '';
    if (!list.length) {
      affiliatesBody.innerHTML = '<tr><td colspan="7" class="muted">No affiliates yet.</td></tr>';
      return;
    }

    list.forEach((a) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${a.name || ''}</td>
        <td>${a.email || ''}</td>
        <td>${a.company || '-'}</td>
        <td>${a.status}</td>
        <td><code>${a.code}</code></td>
        <td>${a.payout_type} ${a.payout_rate}</td>
        <td>
          <button class="btn ghost" data-action="activate" data-id="${a.id}">Activate</button>
          <button class="btn danger" data-action="pause" data-id="${a.id}">Pause</button>
        </td>
      `;
      affiliatesBody.appendChild(tr);
    });
  } catch (err) {
    affiliatesBody.innerHTML = '<tr><td colspan="7" class="muted">Failed to load.</td></tr>';
  }
}

async function loadPayouts() {
  try {
    const res = await apiFetch('/api/affiliates/payouts');
    const list = res.data || [];
    payoutsBody.innerHTML = '';
    if (!list.length) {
      payoutsBody.innerHTML = '<tr><td colspan="5" class="muted">No payouts yet.</td></tr>';
      return;
    }
    list.forEach((p) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.affiliate_name || '-'}</td>
        <td>${p.period_start} - ${p.period_end}</td>
        <td>${p.amount}</td>
        <td>${p.status}</td>
        <td>
          <button class="btn ghost" data-action="approve" data-id="${p.id}">Approve</button>
          <button class="btn danger" data-action="paid" data-id="${p.id}">Mark paid</button>
        </td>
      `;
      payoutsBody.appendChild(tr);
    });
  } catch (err) {
    payoutsBody.innerHTML = '<tr><td colspan="5" class="muted">Failed to load.</td></tr>';
  }
}

async function createAffiliate() {
  affMsg.textContent = '';
  const payload = {
    name: affName.value.trim(),
    email: affEmail.value.trim(),
    company: affCompany.value.trim() || null,
    payout_type: affPayoutType.value,
    payout_rate: Number(affPayoutRate.value || 0),
  };
  if (!payload.name || !payload.email) {
    affMsg.textContent = 'Name and email are required.';
    return;
  }

  affCreate.disabled = true;
  try {
    const res = await apiFetch('/api/affiliates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const tempPassword = res?.data?.temp_password;
    affMsg.textContent = tempPassword
      ? `Temporary password: ${tempPassword}`
      : 'Affiliate created. Login email sent if SMTP is configured.';
    affName.value = '';
    affEmail.value = '';
    affCompany.value = '';
    if (affiliateDefaults) {
      affPayoutType.value = affiliateDefaults.default_payout_type || 'percent';
      affPayoutRate.value = affiliateDefaults.default_payout_rate ?? 30;
    }
    await loadAffiliates();
  } catch (err) {
    showError(err, 'Failed to create affiliate');
  } finally {
    affCreate.disabled = false;
  }
}

async function updateAffiliate(id, status) {
  try {
    await apiFetch(`/api/affiliates/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    showToast(`Affiliate ${status}`);
    await loadAffiliates();
  } catch (err) {
    showError(err, 'Failed to update affiliate');
  }
}

affCreate?.addEventListener('click', createAffiliate);
affRefresh?.addEventListener('click', loadAffiliates);
payoutRefresh?.addEventListener('click', loadPayouts);
exportPayouts?.addEventListener('click', async () => {
  try {
    const res = await apiFetch('/api/affiliates/payouts');
    const list = res.data || [];
    if (!list.length) return showToast('No payouts to export');
    const header = ['affiliate', 'period_start', 'period_end', 'amount', 'status'];
    const rows = list.map((p) => [
      p.affiliate_name || '',
      p.period_start,
      p.period_end,
      p.amount,
      p.status,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\\n');
    downloadCsv(csv, `affiliate-payouts-${new Date().toISOString().slice(0,10)}.csv`);
  } catch (err) {
    showError(err, 'Failed to export');
  }
});

saveAffiliateConfig?.addEventListener('click', async () => {
  affiliateConfigMsg.textContent = '';
  const payload = {
    default_payout_type: affiliateDefaultPayoutType.value,
    default_payout_rate: Number(affiliateDefaultPayoutRate.value || 0),
    payout_hold_days: Number(affiliateHoldDays.value || 0),
    free_signup_points: Number(affiliateSignupPoints.value || 0),
    free_signup_points_expiry_days: Number(affiliatePointsExpiry.value || 0),
    allow_affiliate_coupons: affiliateCouponsEnabled.value === 'true',
    coupon_max_percent_off: Number(affiliateCouponMaxPercent.value || 0),
    coupon_max_duration_months: Number(affiliateCouponMaxDuration.value || 0),
    coupon_default_max_redemptions: Number(affiliateCouponMaxRedemptions.value || 0),
  };
  try {
    const res = await apiFetch('/api/affiliates/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    affiliateDefaults = res.data || payload;
    affiliateConfigMsg.textContent = 'Affiliate defaults saved.';
  } catch (err) {
    affiliateConfigMsg.textContent = 'Failed to save defaults.';
    showError(err, 'Failed to save affiliate defaults');
  }
});

affiliatesBody?.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if (!id) return;
  if (action === 'activate') updateAffiliate(id, 'active');
  if (action === 'pause') updateAffiliate(id, 'paused');
});

payoutsBody?.addEventListener('click', async (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if (!id) return;
  const status = action === 'approve' ? 'approved' : 'paid';
  await apiFetch(`/api/affiliates/payouts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  await loadPayouts();
});

loadAffiliateConfig();
loadAffiliates();
loadPayouts();

function csvCell(value) {
  const v = String(value ?? '');
  if (v.includes(',') || v.includes('\"') || v.includes('\\n')) {
    return `\"${v.replace(/\"/g, '\"\"')}\"`;
  }
  return v;
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

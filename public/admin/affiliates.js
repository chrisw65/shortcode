import { requireAuth, apiFetch, showError, showToast } from '/admin/admin-common.js?v=20260112';

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
    if (tempPassword) {
      affMsg.textContent = `Temporary password: ${tempPassword}`;
    } else {
      showToast('Affiliate created');
    }
    affName.value = '';
    affEmail.value = '';
    affCompany.value = '';
    affPayoutRate.value = '30';
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

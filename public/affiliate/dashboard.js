const token = localStorage.getItem('affiliate_token') || '';

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '-';
}

async function api(path) {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => null);
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
    setText('affPending', summary.pending_amount || 0);
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
      return `<p>${when} - ${c.status} conversion - $${c.amount}</p>`;
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

if (!token) {
  window.location.href = '/affiliate/login.html';
} else {
  loadAffiliate();
  loadSummary();
  loadActivity();
  loadPayouts();
}

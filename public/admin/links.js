// ===== Local, self-contained helpers (no imports) =====
const TOKEN_KEY = 'admin_token';
function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}
function requireAuth() {
  const t = getToken();
  if (!t) { location.replace('/admin/index.html'); throw new Error('Not authenticated'); }
  return t;
}
async function api(path, { method = 'GET', body, headers } = {}) {
  const token = getToken();
  const h = new Headers(headers || {});
  h.set('Accept', 'application/json');
  const isJSON = body && typeof body === 'object' && !(body instanceof FormData);
  if (isJSON) h.set('Content-Type', 'application/json');
  if (token) h.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { method, headers: h, body: isJSON ? JSON.stringify(body) : body || null });
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) { try { data = await res.json(); } catch {} } else { data = await res.text().catch(() => null); }
  if (!res.ok) {
    const msg = (data && data.error) || (data && data.message) || `HTTP ${res.status}`;
    const err = new Error(msg); err.status = res.status; err.payload = data; throw err;
  }
  return (data && typeof data === 'object' && 'data' in data) ? data.data : data;
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly','');
    ta.style.position='absolute'; ta.style.left='-9999px'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } finally { ta.remove(); }
    return true;
  }
}
function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v); if (isNaN(d)) return '—';
  return d.toLocaleString(undefined, { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
}
function hostFrom(url) { try { return new URL(url).host; } catch { return '—'; } }
// =====================================================

requireAuth(); // redirect if not signed in

// Nav logout (keep here to avoid touching other pages)
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  clearToken(); location.replace('/admin/index.html');
});

const els = {
  inUrl:     document.getElementById('inUrl'),
  inTitle:   document.getElementById('inTitle'),
  inCode:    document.getElementById('inCode'),
  btnCreate: document.getElementById('btnCreate'),
  inFilter:  document.getElementById('inFilter'),
  btnRefresh:document.getElementById('btnRefresh'),
  btnExport: document.getElementById('btnExport'),
  tbody:     document.getElementById('rows'),
  table:     document.getElementById('tbl'),
};

let allLinks = [];
let sortKey = 'created_at';
let sortDir = 'desc'; // 'asc'|'desc'
let filterText = '';

function applyFilter(list) {
  if (!filterText) return list;
  const q = filterText.toLowerCase();
  return list.filter(l =>
    (l.title || '').toLowerCase().includes(q) ||
    (l.short_code || '').toLowerCase().includes(q)
  );
}
function applySort(list) {
  const dir = sortDir === 'asc' ? 1 : -1;
  return list.slice().sort((a, b) => {
    const va = (a[sortKey] ?? ''), vb = (b[sortKey] ?? '');
    if (sortKey === 'click_count') return (Number(va) - Number(vb)) * dir;
    if (sortKey === 'created_at')   return (new Date(va) - new Date(vb)) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });
}

function render() {
  const list = applySort(applyFilter(allLinks));
  if (!list.length) {
    els.tbody.innerHTML = `<tr><td class="empty" colspan="7">No links found.</td></tr>`;
    return;
  }

  els.tbody.innerHTML = list.map(l => {
    const domain = hostFrom(l.short_url || '');
    const code   = l.short_code || '';
    const short  = l.short_url || '';
    const clicks = l.click_count ?? 0;
    const created= fmtDate(l.created_at);
    return `
      <tr data-id="${l.id}" data-code="${code}">
        <td>${escapeHtml(l.title || '—')}</td>
        <td><span class="pill">${escapeHtml(code)}</span></td>
        <td>${escapeHtml(domain)}</td>
        <td>
          <a href="${short}" target="_blank" rel="noopener">${short}</a>
          <button class="btn btn-copy" style="margin-left:6px">Copy</button>
        </td>
        <td>${clicks}</td>
        <td>${created}</td>
        <td class="row" style="gap:6px">
          <a class="btn" href="/api/qr/${encodeURIComponent(code)}.png" target="_blank" rel="noopener">QR PNG</a>
          <a class="btn" href="/api/qr/${encodeURIComponent(code)}.svg" target="_blank" rel="noopener">QR SVG</a>
          <a class="btn" href="/admin/analytics.html?code=${encodeURIComponent(code)}">Analytics</a>
          <button class="btn danger btn-del">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  // wire buttons
  els.tbody.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tr = e.currentTarget.closest('tr');
      const code = tr?.dataset.code || '';
      const link = allLinks.find(x => x.short_code === code);
      if (link?.short_url) copyText(link.short_url);
    });
  });

  els.tbody.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tr = e.currentTarget.closest('tr');
      const id = tr?.dataset.id;
      const code = tr?.dataset.code;
      if (!id) return;
      if (!confirm(`Delete link "${code}"?`)) return;
      try {
        await api(`/api/links/${encodeURIComponent(code)}`, { method: 'DELETE' });
        allLinks = allLinks.filter(l => l.short_code !== code);
        render();
      } catch (err) {
        alert(`Delete failed: ${err.message || err}`);
      }
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}

async function load() {
  try {
    const data = await api('/api/links');
    // Normalise keys we rely on
    allLinks = (Array.isArray(data) ? data : []).map(x => ({
      id: x.id,
      title: x.title,
      short_code: x.short_code,
      short_url: x.short_url,
      click_count: x.click_count ?? 0,
      created_at: x.created_at,
    }));
    render();
  } catch (err) {
    console.error('Load error:', err);
    els.tbody.innerHTML = `<tr><td class="empty danger" colspan="7">Failed to load links.</td></tr>`;
  }
}

async function createLink() {
  const url = (els.inUrl.value || '').trim();
  const title = (els.inTitle.value || '').trim();
  const code = (els.inCode.value || '').trim();

  if (!url) { alert('Please enter a destination URL.'); els.inUrl.focus(); return; }

  els.btnCreate.disabled = true;
  try {
    const body = { url, title };
    if (code) body.short_code = code;        // server expects short_code
    const res = await api('/api/links', { method: 'POST', body });
    // Prepend newly created (if API returns a single item)
    await load();
    els.inUrl.value = ''; els.inTitle.value = ''; els.inCode.value = '';
  } catch (err) {
    alert(`Create failed: ${err.message || err}`);
  } finally {
    els.btnCreate.disabled = false;
  }
}

function exportCSV() {
  if (!allLinks.length) return;
  const header = ['title','short_code','short_url','click_count','created_at'];
  const rows = [header.join(',')].concat(
    allLinks.map(l => header.map(k => csvCell(l[k])).join(','))
  );
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'links.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}
function csvCell(v) {
  if (v == null) return '';
  const s = String(v).replaceAll('"','""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

// Sorting
els.table.querySelectorAll('th[data-sort]').forEach(th => {
  th.style.cursor = 'pointer';
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-sort');
    if (sortKey === key) sortDir = (sortDir === 'asc' ? 'desc' : 'asc');
    else { sortKey = key; sortDir = 'desc'; }
    render();
  });
});

// Filtering (debounced)
let tFilter = 0;
els.inFilter.addEventListener('input', () => {
  clearTimeout(tFilter);
  tFilter = setTimeout(() => { filterText = els.inFilter.value.trim(); render(); }, 150);
});

// Actions
els.btnCreate.addEventListener('click', createLink);
els.btnRefresh.addEventListener('click', load);
els.btnExport.addEventListener('click', exportCSV);

// Go
load();

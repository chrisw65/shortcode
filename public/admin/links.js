import { requireAuth, api, mountNav, htmlesc, copyText } from '/admin/admin-common.js?v=20260111';

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v); if (isNaN(d)) return '—';
  return d.toLocaleString(undefined, { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
}
function hostFrom(url) { try { return new URL(url).host; } catch { return '—'; } }

function unwrap(res) {
  return (res && typeof res === 'object' && 'data' in res) ? res.data : res;
}

requireAuth();
mountNav('links');

const els = {
  inUrl:     document.getElementById('inUrl'),
  inTitle:   document.getElementById('inTitle'),
  inCode:    document.getElementById('inCode'),
  inDomain:  document.getElementById('inDomain'),
  btnCreate: document.getElementById('btnCreate'),
  codeStatus: document.getElementById('codeStatus'),
  codePreviewValue: document.getElementById('codePreviewValue'),
  inFilter:  document.getElementById('inFilter'),
  btnRefresh:document.getElementById('btnRefresh'),
  btnExport: document.getElementById('btnExport'),
  tbody:     document.getElementById('rows'),
  table:     document.getElementById('tbl'),
  qrModal:   document.getElementById('qrModal'),
  qrBackdrop:document.getElementById('qrBackdrop'),
  qrClose:   document.getElementById('qrClose'),
  qrImage:   document.getElementById('qrImage'),
  qrTitle:   document.getElementById('qrTitle'),
  qrDownload:document.getElementById('qrDownload'),
};

let allLinks = [];
let sortKey = 'created_at';
let sortDir = 'desc'; // 'asc'|'desc'
let filterText = '';
let coreHost = 'https://okleaf.lnk';
let effectivePlan = 'free';
let domains = [];

function setCodeStatus(state, text) {
  if (!els.codeStatus) return;
  els.codeStatus.className = `status ${state || 'muted'}`;
  els.codeStatus.textContent = text || '';
}

function updateCodePreview(code) {
  if (!els.codePreviewValue) return;
  els.codePreviewValue.textContent = code || 'your-code';
}

function selectedDomain() {
  const value = (els.inDomain?.value || '').trim();
  if (!value) return { id: '', host: coreHost.replace(/^https?:\/\//, '') };
  const hit = domains.find(d => d.id === value);
  return { id: value, host: (hit?.domain || coreHost).replace(/^https?:\/\//, '') };
}

function updatePreviewHost() {
  const { host } = selectedDomain();
  const node = document.getElementById('codePreview');
  if (node) node.innerHTML = `Short URL: https://${htmlesc(host)}/<span id="codePreviewValue">${htmlesc(els.inCode.value || 'your-code')}</span>`;
  els.codePreviewValue = document.getElementById('codePreviewValue');
}

function renderDomainSelect() {
  if (!els.inDomain) return;
  const options = [];
  const coreLabel = coreHost.replace(/^https?:\/\//, '');
  options.push(`<option value="">${coreLabel} (core)</option>`);

  const available = domains.filter(d => d.verified && d.is_active);
  if (isPaid()) {
    for (const d of available) {
      options.push(`<option value="${htmlesc(d.id)}">${htmlesc(d.domain)}</option>`);
    }
  }

  els.inDomain.innerHTML = options.join('');
  if (!isPaid()) {
    els.inDomain.disabled = true;
  } else {
    els.inDomain.disabled = false;
  }
  updatePreviewHost();
}

function isPaid() {
  return String(effectivePlan || '').toLowerCase() !== 'free';
}

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
        <td>${htmlesc(l.title || '—')}</td>
        <td><span class="pill">${htmlesc(code)}</span></td>
        <td>${htmlesc(domain)}</td>
        <td>
          <a href="${short}" target="_blank" rel="noopener">${short}</a>
          <button class="btn btn-copy" style="margin-left:6px">Copy</button>
        </td>
        <td>${clicks}</td>
        <td>${created}</td>
        <td class="row" style="gap:6px">
          <button class="btn btn-qr" data-type="png" data-code="${htmlesc(code)}">QR PNG</button>
          <button class="btn btn-qr" data-type="svg" data-code="${htmlesc(code)}">QR SVG</button>
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

  els.tbody.querySelectorAll('.btn-qr').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code || '';
      const type = btn.dataset.type || 'png';
      openQrModal(code, type);
    });
  });
}

async function load() {
  try {
    const data = unwrap(await api('/api/links'));
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

async function loadContext() {
  try {
    const [coreRes, meRes, domainRes] = await Promise.all([
      api('/api/links/core-domain'),
      api('/api/auth/me'),
      api('/api/domains'),
    ]);

    const core = unwrap(coreRes) || {};
    if (core.base_url) coreHost = core.base_url;

    const me = unwrap(meRes) || {};
    effectivePlan = me.effective_plan || me.user?.plan || 'free';

    const list = unwrap(domainRes);
    domains = Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('Context load failed:', err);
  } finally {
    renderDomainSelect();
    const host = selectedDomain().host;
    setCodeStatus('muted', `Auto-generate on ${host}.`);
  }
}

async function createLink() {
  const url = (els.inUrl.value || '').trim();
  const title = (els.inTitle.value || '').trim();
  const code = (els.inCode.value || '').trim();
  const domain = selectedDomain();

  if (!url) { alert('Please enter a destination URL.'); els.inUrl.focus(); return; }

  els.btnCreate.disabled = true;
  try {
    const body = { url, title };
    if (code) body.short_code = code;        // server expects short_code
    if (domain.id) body.domain_id = domain.id;
    const res = unwrap(await api('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
    // Prepend newly created (if API returns a single item)
    await load();
    els.inUrl.value = ''; els.inTitle.value = ''; els.inCode.value = '';
    updateCodePreview('');
    setCodeStatus('muted', `Auto-generate on ${selectedDomain().host}.`);
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

function openQrModal(code, type) {
  if (!els.qrModal || !els.qrImage) return;
  const safeType = (type === 'svg') ? 'svg' : 'png';
  const src = `/api/qr/${encodeURIComponent(code)}.${safeType}`;
  els.qrImage.src = src;
  if (els.qrTitle) els.qrTitle.textContent = `QR code (${code})`;
  if (els.qrDownload) {
    els.qrDownload.href = src;
    els.qrDownload.download = `qr-${code}.${safeType}`;
  }
  els.qrModal.classList.add('open');
  els.qrModal.setAttribute('aria-hidden', 'false');
}

function closeQrModal() {
  if (!els.qrModal) return;
  els.qrModal.classList.remove('open');
  els.qrModal.setAttribute('aria-hidden', 'true');
  if (els.qrImage) els.qrImage.src = '';
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

// Code availability (debounced)
let tCode = 0;
els.inCode.addEventListener('input', () => {
  clearTimeout(tCode);
  tCode = setTimeout(async () => {
    const raw = (els.inCode.value || '').trim();
    if (!raw) {
      updateCodePreview('');
      setCodeStatus('muted', `Auto-generate on ${selectedDomain().host}.`);
      return;
    }
    updateCodePreview(raw);
    setCodeStatus('pending', 'Checking availability...');
    try {
      const data = unwrap(await api(`/api/links/availability/${encodeURIComponent(raw)}`));
      if (data?.available) {
        setCodeStatus('ok', `Available on ${selectedDomain().host}.`);
      } else {
        setCodeStatus('bad', data?.reason || 'Not available.');
      }
    } catch (err) {
      setCodeStatus('bad', 'Availability check failed.');
    }
  }, 300);
});

els.inDomain?.addEventListener('change', () => {
  updatePreviewHost();
  const raw = (els.inCode.value || '').trim();
  if (!raw) {
    setCodeStatus('muted', `Auto-generate on ${selectedDomain().host}.`);
    return;
  }
  setCodeStatus('pending', 'Checking availability...');
  api(`/api/links/availability/${encodeURIComponent(raw)}`)
    .then(res => {
      const data = unwrap(res);
      if (data?.available) setCodeStatus('ok', `Available on ${selectedDomain().host}.`);
      else setCodeStatus('bad', data?.reason || 'Not available.');
    })
    .catch(() => setCodeStatus('bad', 'Availability check failed.'));
});

// Actions
els.btnCreate.addEventListener('click', createLink);
els.btnRefresh.addEventListener('click', load);
els.btnExport.addEventListener('click', exportCSV);
els.qrClose?.addEventListener('click', closeQrModal);
els.qrBackdrop?.addEventListener('click', closeQrModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeQrModal();
});

// Go
loadContext();
load();

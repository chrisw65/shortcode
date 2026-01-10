import { requireAuth, api, mountNav, htmlesc, copyText } from '/admin/admin-common.js?v=20260112';

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
  inTags:    document.getElementById('inTags'),
  inGroup:   document.getElementById('inGroup'),
  utmSource: document.getElementById('utmSource'),
  utmMedium: document.getElementById('utmMedium'),
  utmCampaign: document.getElementById('utmCampaign'),
  utmTerm:   document.getElementById('utmTerm'),
  utmContent: document.getElementById('utmContent'),
  utmPreview: document.getElementById('utmPreview'),
  utmApply:  document.getElementById('utmApply'),
  utmClear:  document.getElementById('utmClear'),
  btnCreate: document.getElementById('btnCreate'),
  codeStatus: document.getElementById('codeStatus'),
  codePreviewValue: document.getElementById('codePreviewValue'),
  inFilter:  document.getElementById('inFilter'),
  filterTag: document.getElementById('filterTag'),
  filterGroup: document.getElementById('filterGroup'),
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
  tagName:   document.getElementById('tagName'),
  tagColor:  document.getElementById('tagColor'),
  tagAdd:    document.getElementById('tagAdd'),
  tagsList:  document.getElementById('tagsList'),
  groupName: document.getElementById('groupName'),
  groupDesc: document.getElementById('groupDesc'),
  groupAdd:  document.getElementById('groupAdd'),
  groupsList:document.getElementById('groupsList'),
};

let allLinks = [];
let sortKey = 'created_at';
let sortDir = 'desc'; // 'asc'|'desc'
let filterText = '';
let filterTagId = '';
let filterGroupId = '';
let coreHost = 'https://okleaf.lnk';
let effectivePlan = 'free';
let domains = [];
let tags = [];
let groups = [];

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
  const q = filterText.toLowerCase();
  return list.filter(l => {
    const baseMatch = !filterText || (l.title || '').toLowerCase().includes(q) || (l.short_code || '').toLowerCase().includes(q);
    const tagMatch = !filterTagId || (l.tags || []).some(t => t.id === filterTagId);
    const groupMatch = !filterGroupId || (l.groups || []).some(g => g.id === filterGroupId);
    return baseMatch && tagMatch && groupMatch;
  });
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
    els.tbody.innerHTML = `<tr><td class="empty" colspan="9">No links found.</td></tr>`;
    return;
  }

  els.tbody.innerHTML = list.map(l => {
    const domain = hostFrom(l.short_url || '');
    const code   = l.short_code || '';
    const short  = l.short_url || '';
    const clicks = l.click_count ?? 0;
    const created= fmtDate(l.created_at);
    const tagHtml = (l.tags || []).length
      ? (l.tags || []).map(t => {
        const color = t.color ? ` style="border-color:${htmlesc(t.color)};color:${htmlesc(t.color)}"` : '';
        return `<span class="pill"${color}>${htmlesc(t.name)}</span>`;
      }).join(' ')
      : '<span class="muted">—</span>';
    const groupHtml = (l.groups || []).length
      ? (l.groups || []).map(g => `<span class="badge">${htmlesc(g.name)}</span>`).join(' ')
      : '<span class="muted">—</span>';
    return `
      <tr data-id="${l.id}" data-code="${code}">
        <td>${htmlesc(l.title || '—')}</td>
        <td>${tagHtml}</td>
        <td>${groupHtml}</td>
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
      tags: Array.isArray(x.tags) ? x.tags : [],
      groups: Array.isArray(x.groups) ? x.groups : [],
    }));
    render();
  } catch (err) {
    console.error('Load error:', err);
    els.tbody.innerHTML = `<tr><td class="empty danger" colspan="9">Failed to load links.</td></tr>`;
  }
}

async function loadContext() {
  try {
    const [coreRes, meRes, domainRes, tagRes, groupRes] = await Promise.all([
      api('/api/links/core-domain'),
      api('/api/auth/me'),
      api('/api/domains'),
      api('/api/tags'),
      api('/api/groups'),
    ]);

    const core = unwrap(coreRes) || {};
    if (core.base_url) coreHost = core.base_url;

    const me = unwrap(meRes) || {};
    effectivePlan = me.effective_plan || me.user?.plan || 'free';

    const list = unwrap(domainRes);
    domains = Array.isArray(list) ? list : [];

    const tagList = unwrap(tagRes);
    tags = Array.isArray(tagList) ? tagList : [];
    const groupList = unwrap(groupRes);
    groups = Array.isArray(groupList) ? groupList : [];
  } catch (err) {
    console.warn('Context load failed:', err);
  } finally {
    renderDomainSelect();
    renderTagSelects();
    renderGroupSelects();
    renderTagsList();
    renderGroupsList();
    const host = selectedDomain().host;
    setCodeStatus('muted', `Auto-generate on ${host}.`);
  }
}

function renderTagSelects() {
  if (els.inTags) {
    const options = tags.map(t => `<option value="${htmlesc(t.id)}">${htmlesc(t.name)}</option>`);
    els.inTags.innerHTML = options.join('');
  }
  if (els.filterTag) {
    const options = ['<option value="">All tags</option>'].concat(
      tags.map(t => `<option value="${htmlesc(t.id)}">${htmlesc(t.name)}</option>`)
    );
    els.filterTag.innerHTML = options.join('');
    if (filterTagId && !tags.find(t => t.id === filterTagId)) filterTagId = '';
    els.filterTag.value = filterTagId || '';
  }
}

function renderGroupSelects() {
  if (els.inGroup) {
    const options = ['<option value="">No group</option>'].concat(
      groups.map(g => `<option value="${htmlesc(g.id)}">${htmlesc(g.name)}</option>`)
    );
    els.inGroup.innerHTML = options.join('');
  }
  if (els.filterGroup) {
    const options = ['<option value="">All groups</option>'].concat(
      groups.map(g => `<option value="${htmlesc(g.id)}">${htmlesc(g.name)}</option>`)
    );
    els.filterGroup.innerHTML = options.join('');
    if (filterGroupId && !groups.find(g => g.id === filterGroupId)) filterGroupId = '';
    els.filterGroup.value = filterGroupId || '';
  }
}

function renderTagsList() {
  if (!els.tagsList) return;
  if (!tags.length) {
    els.tagsList.innerHTML = '<div class="muted">No tags yet.</div>';
    return;
  }
  els.tagsList.innerHTML = tags.map(t => `
    <div class="row" style="justify-content:space-between">
      <div class="row">
        <span class="pill"${t.color ? ` style="border-color:${htmlesc(t.color)};color:${htmlesc(t.color)}"` : ''}>${htmlesc(t.name)}</span>
        <span class="muted small">${htmlesc(t.color || '')}</span>
      </div>
      <div class="row" style="gap:6px">
        <button class="btn ghost btn-tag-edit" data-id="${htmlesc(t.id)}">Edit</button>
        <button class="btn danger btn-tag-delete" data-id="${htmlesc(t.id)}">Delete</button>
      </div>
    </div>
  `).join('');

  els.tagsList.querySelectorAll('.btn-tag-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTag(btn.dataset.id));
  });
  els.tagsList.querySelectorAll('.btn-tag-edit').forEach(btn => {
    btn.addEventListener('click', () => editTag(btn.dataset.id));
  });
}

function renderGroupsList() {
  if (!els.groupsList) return;
  if (!groups.length) {
    els.groupsList.innerHTML = '<div class="muted">No groups yet.</div>';
    return;
  }
  els.groupsList.innerHTML = groups.map(g => `
    <div class="row" style="justify-content:space-between">
      <div>
        <div style="font-weight:600">${htmlesc(g.name)}</div>
        <div class="muted small">${htmlesc(g.description || '')}</div>
      </div>
      <div class="row" style="gap:6px">
        <button class="btn ghost btn-group-edit" data-id="${htmlesc(g.id)}">Edit</button>
        <button class="btn danger btn-group-delete" data-id="${htmlesc(g.id)}">Delete</button>
      </div>
    </div>
  `).join('');

  els.groupsList.querySelectorAll('.btn-group-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteGroup(btn.dataset.id));
  });
  els.groupsList.querySelectorAll('.btn-group-edit').forEach(btn => {
    btn.addEventListener('click', () => editGroup(btn.dataset.id));
  });
}

async function createTag() {
  const name = (els.tagName?.value || '').trim();
  const color = (els.tagColor?.value || '').trim();
  if (!name) return alert('Tag name is required.');
  try {
    await api('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: color || null }),
    });
    if (els.tagName) els.tagName.value = '';
    if (els.tagColor) els.tagColor.value = '';
    await refreshTags();
  } catch (err) {
    alert(`Tag create failed: ${err.message || err}`);
  }
}

async function editTag(id) {
  const tag = tags.find(t => t.id === id);
  if (!tag) return;
  const name = window.prompt('Tag name', tag.name || '');
  if (!name) return;
  const color = window.prompt('Tag color (optional)', tag.color || '') || '';
  try {
    await api(`/api/tags/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: color || null }),
    });
    await refreshTags();
  } catch (err) {
    alert(`Tag update failed: ${err.message || err}`);
  }
}

async function deleteTag(id) {
  if (!id) return;
  if (!confirm('Delete this tag?')) return;
  try {
    await api(`/api/tags/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await refreshTags();
  } catch (err) {
    alert(`Tag delete failed: ${err.message || err}`);
  }
}

async function createGroup() {
  const name = (els.groupName?.value || '').trim();
  const description = (els.groupDesc?.value || '').trim();
  if (!name) return alert('Group name is required.');
  try {
    await api('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: description || null }),
    });
    if (els.groupName) els.groupName.value = '';
    if (els.groupDesc) els.groupDesc.value = '';
    await refreshGroups();
  } catch (err) {
    alert(`Group create failed: ${err.message || err}`);
  }
}

async function editGroup(id) {
  const group = groups.find(g => g.id === id);
  if (!group) return;
  const name = window.prompt('Group name', group.name || '');
  if (!name) return;
  const description = window.prompt('Group description (optional)', group.description || '') || '';
  try {
    await api(`/api/groups/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: description || null }),
    });
    await refreshGroups();
  } catch (err) {
    alert(`Group update failed: ${err.message || err}`);
  }
}

async function deleteGroup(id) {
  if (!id) return;
  if (!confirm('Delete this group?')) return;
  try {
    await api(`/api/groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await refreshGroups();
  } catch (err) {
    alert(`Group delete failed: ${err.message || err}`);
  }
}

async function refreshTags() {
  try {
    const data = unwrap(await api('/api/tags'));
    tags = Array.isArray(data) ? data : [];
    renderTagSelects();
    renderTagsList();
  } catch (err) {
    console.warn('Tag refresh failed:', err);
  }
}

async function refreshGroups() {
  try {
    const data = unwrap(await api('/api/groups'));
    groups = Array.isArray(data) ? data : [];
    renderGroupSelects();
    renderGroupsList();
  } catch (err) {
    console.warn('Group refresh failed:', err);
  }
}

function buildUtmUrl(url, params) {
  try {
    const next = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (!value) return;
      next.searchParams.set(key, value);
    });
    return next.toString();
  } catch {
    return null;
  }
}

function readUtmParams() {
  return {
    utm_source: (els.utmSource?.value || '').trim(),
    utm_medium: (els.utmMedium?.value || '').trim(),
    utm_campaign: (els.utmCampaign?.value || '').trim(),
    utm_term: (els.utmTerm?.value || '').trim(),
    utm_content: (els.utmContent?.value || '').trim(),
  };
}

function updateUtmPreview() {
  if (!els.utmPreview) return;
  const params = readUtmParams();
  const hasUtm = Object.values(params).some(Boolean);
  if (!hasUtm) {
    els.utmPreview.textContent = 'No UTM parameters.';
    return;
  }
  const baseUrl = (els.inUrl.value || '').trim();
  const preview = baseUrl ? buildUtmUrl(baseUrl, params) : null;
  els.utmPreview.textContent = preview || 'Enter a valid URL to preview UTM.';
}

async function createLink() {
  let url = (els.inUrl.value || '').trim();
  const title = (els.inTitle.value || '').trim();
  const code = (els.inCode.value || '').trim();
  const domain = selectedDomain();
  const tagIds = Array.from(els.inTags?.selectedOptions || []).map(opt => opt.value).filter(Boolean);
  const groupId = (els.inGroup?.value || '').trim();
  const utmParams = readUtmParams();
  if (Object.values(utmParams).some(Boolean)) {
    const built = buildUtmUrl(url, utmParams);
    if (built) url = built;
  }

  if (!url) { alert('Please enter a destination URL.'); els.inUrl.focus(); return; }

  els.btnCreate.disabled = true;
  try {
    const body = { url, title };
    if (code) body.short_code = code;        // server expects short_code
    if (domain.id) body.domain_id = domain.id;
    if (tagIds.length) body.tag_ids = tagIds;
    if (groupId) body.group_ids = [groupId];
    const res = unwrap(await api('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
    // Prepend newly created (if API returns a single item)
    await load();
    els.inUrl.value = ''; els.inTitle.value = ''; els.inCode.value = '';
    if (els.inTags) Array.from(els.inTags.options).forEach(o => { o.selected = false; });
    if (els.inGroup) els.inGroup.value = '';
    if (els.utmSource) els.utmSource.value = '';
    if (els.utmMedium) els.utmMedium.value = '';
    if (els.utmCampaign) els.utmCampaign.value = '';
    if (els.utmTerm) els.utmTerm.value = '';
    if (els.utmContent) els.utmContent.value = '';
    updateUtmPreview();
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
  const header = ['title','short_code','short_url','click_count','created_at','tags','groups'];
  const rows = [header.join(',')].concat(
    allLinks.map(l => header.map(k => {
      if (k === 'tags') return csvCell((l.tags || []).map(t => t.name).join('; '));
      if (k === 'groups') return csvCell((l.groups || []).map(g => g.name).join('; '));
      return csvCell(l[k]);
    }).join(','))
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
els.filterTag?.addEventListener('change', () => {
  filterTagId = els.filterTag.value || '';
  render();
});
els.filterGroup?.addEventListener('change', () => {
  filterGroupId = els.filterGroup.value || '';
  render();
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
els.tagAdd?.addEventListener('click', createTag);
els.groupAdd?.addEventListener('click', createGroup);
els.utmApply?.addEventListener('click', () => {
  const params = readUtmParams();
  const hasUtm = Object.values(params).some(Boolean);
  if (!hasUtm) return;
  const base = (els.inUrl.value || '').trim();
  const updated = buildUtmUrl(base, params);
  if (updated && els.inUrl) {
    els.inUrl.value = updated;
    updateUtmPreview();
  }
});
els.utmClear?.addEventListener('click', () => {
  if (els.utmSource) els.utmSource.value = '';
  if (els.utmMedium) els.utmMedium.value = '';
  if (els.utmCampaign) els.utmCampaign.value = '';
  if (els.utmTerm) els.utmTerm.value = '';
  if (els.utmContent) els.utmContent.value = '';
  updateUtmPreview();
});
['utmSource','utmMedium','utmCampaign','utmTerm','utmContent','inUrl'].forEach(key => {
  const el = els[key];
  if (el) el.addEventListener('input', () => updateUtmPreview());
});
els.qrClose?.addEventListener('click', closeQrModal);
els.qrBackdrop?.addEventListener('click', closeQrModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeQrModal();
});

// Go
loadContext();
load();
updateUtmPreview();

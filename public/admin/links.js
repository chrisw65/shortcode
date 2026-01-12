import { requireAuth, api, mountNav, htmlesc, copyText, showToast } from '/admin/admin-common.js?v=20260120';

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

const tabButtons = Array.from(document.querySelectorAll('[data-tab]'));
const tabPanels = Array.from(document.querySelectorAll('[data-panel]'));

function setActiveTab(name) {
  tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === name;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === name);
  });
  sessionStorage.setItem('links_tab', name);
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.tab || 'create';
    setActiveTab(name);
  });
});

setActiveTab(sessionStorage.getItem('links_tab') || 'manage');

const els = {
  inUrl:     document.getElementById('inUrl'),
  inTitle:   document.getElementById('inTitle'),
  inCode:    document.getElementById('inCode'),
  inDomain:  document.getElementById('inDomain'),
  inPassword: document.getElementById('inPassword'),
  inDeepLink: document.getElementById('inDeepLink'),
  inDeepLinkEnabled: document.getElementById('inDeepLinkEnabled'),
  inIosFallback: document.getElementById('inIosFallback'),
  inAndroidFallback: document.getElementById('inAndroidFallback'),
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
  utmWizard: document.getElementById('utmWizard'),
  utmWizardBadge: document.getElementById('utmWizardBadge'),
  utmWizardPrev: document.getElementById('utmWizardPrev'),
  utmWizardNext: document.getElementById('utmWizardNext'),
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
  variantsModal: document.getElementById('variantsModal'),
  variantsBackdrop: document.getElementById('variantsBackdrop'),
  variantsClose: document.getElementById('variantsClose'),
  variantsList: document.getElementById('variantsList'),
  variantsMsg: document.getElementById('variantsMsg'),
  variantAdd: document.getElementById('variantAdd'),
  variantsSave: document.getElementById('variantsSave'),
  variantsTotal: document.getElementById('variantsTotal'),
  variantsNormalize: document.getElementById('variantsNormalize'),
  routesModal: document.getElementById('routesModal'),
  routesBackdrop: document.getElementById('routesBackdrop'),
  routesClose: document.getElementById('routesClose'),
  routesList: document.getElementById('routesList'),
  routesMsg: document.getElementById('routesMsg'),
  routeAdd: document.getElementById('routeAdd'),
  routesSave: document.getElementById('routesSave'),
  passwordModal: document.getElementById('passwordModal'),
  passwordBackdrop: document.getElementById('passwordBackdrop'),
  passwordClose: document.getElementById('passwordClose'),
  passwordValue: document.getElementById('passwordValue'),
  passwordMsg: document.getElementById('passwordMsg'),
  passwordSave: document.getElementById('passwordSave'),
  passwordClear: document.getElementById('passwordClear'),
  tagName:   document.getElementById('tagName'),
  tagColor:  document.getElementById('tagColor'),
  tagAdd:    document.getElementById('tagAdd'),
  tagsList:  document.getElementById('tagsList'),
  groupName: document.getElementById('groupName'),
  groupDesc: document.getElementById('groupDesc'),
  groupAdd:  document.getElementById('groupAdd'),
  groupsList:document.getElementById('groupsList'),
  bulkUrls: document.getElementById('bulkUrls'),
  bulkDomain: document.getElementById('bulkDomain'),
  bulkPassword: document.getElementById('bulkPassword'),
  bulkCsv: document.getElementById('bulkCsv'),
  bulkImportMode: document.getElementById('bulkImportMode'),
  bulkTags: document.getElementById('bulkTags'),
  bulkGroup: document.getElementById('bulkGroup'),
  bulkCreateBtn: document.getElementById('bulkCreateBtn'),
  bulkCreateMsg: document.getElementById('bulkCreateMsg'),
  bulkDeleteCodes: document.getElementById('bulkDeleteCodes'),
  bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),
  bulkDeleteMsg: document.getElementById('bulkDeleteMsg'),
};

const utmWizardSteps = els.utmWizard ? Array.from(els.utmWizard.querySelectorAll('.wizard-step')) : [];
const utmWizardPanels = els.utmWizard ? Array.from(els.utmWizard.querySelectorAll('.wizard-panel')) : [];

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
let selectedVariantCode = '';
let selectedRouteCode = '';
let selectedPasswordCode = '';
let uiMode = 'beginner';
let utmWizardStep = 1;

function setCodeStatus(state, text) {
  if (!els.codeStatus) return;
  els.codeStatus.className = `status ${state || 'muted'}`;
  els.codeStatus.textContent = text || '';
}

function setUtmWizardStep(step) {
  if (!els.utmWizard) return;
  const maxStep = utmWizardPanels.length || 1;
  utmWizardStep = Math.min(Math.max(step, 1), maxStep);
  els.utmWizard.dataset.step = String(utmWizardStep);
  utmWizardSteps.forEach((btn) => {
    const active = Number(btn.dataset.step) === utmWizardStep;
    btn.classList.toggle('active', active);
  });
  utmWizardPanels.forEach((panel) => {
    const active = Number(panel.dataset.step) === utmWizardStep;
    panel.classList.toggle('active', active);
  });
  if (els.utmWizardPrev) els.utmWizardPrev.disabled = utmWizardStep <= 1;
  if (els.utmWizardNext) els.utmWizardNext.disabled = utmWizardStep >= maxStep;
}

function setUtmWizardMode(mode) {
  if (!els.utmWizard) return;
  const expert = mode === 'expert';
  els.utmWizard.classList.toggle('wizard-expert', expert);
  if (els.utmWizardBadge) els.utmWizardBadge.textContent = expert ? 'Expert mode' : 'Beginner mode';
  if (expert) {
    utmWizardPanels.forEach((panel) => panel.classList.add('active'));
  } else {
    utmWizardPanels.forEach((panel) => panel.classList.remove('active'));
    setUtmWizardStep(utmWizardStep || 1);
  }
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

function renderBulkDomainSelect() {
  if (!els.bulkDomain) return;
  const options = [];
  const coreLabel = coreHost.replace(/^https?:\/\//, '');
  options.push(`<option value="">${coreLabel} (core)</option>`);

  const available = domains.filter(d => d.verified && d.is_active);
  if (isPaid()) {
    for (const d of available) {
      options.push(`<option value="${htmlesc(d.id)}">${htmlesc(d.domain)}</option>`);
    }
  }
  els.bulkDomain.innerHTML = options.join('');
  els.bulkDomain.disabled = !isPaid();
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
    els.tbody.innerHTML = `<tr><td class="empty" colspan="10">No links found.</td></tr>`;
    return;
  }

  els.tbody.innerHTML = list.map(l => {
    const domain = hostFrom(l.short_url || '');
    const code   = l.short_code || '';
    const short  = l.short_url || '';
    const clicks = l.click_count ?? 0;
    const created= fmtDate(l.created_at);
    const security = l.password_protected ? '<span class="badge">Protected</span>' : '<span class="muted">—</span>';
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
        <td>${security}</td>
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
          <button class="btn btn-variants" data-code="${htmlesc(code)}">Variants</button>
          <button class="btn btn-routes" data-code="${htmlesc(code)}">Routing</button>
          <button class="btn btn-protect" data-code="${htmlesc(code)}">${l.password_protected ? 'Reset password' : 'Protect'}</button>
          ${l.password_protected ? `<button class="btn ghost btn-clear" data-code="${htmlesc(code)}">Clear</button>` : ''}
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

  els.tbody.querySelectorAll('.btn-variants').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code || '';
      openVariantsModal(code);
    });
  });

  els.tbody.querySelectorAll('.btn-routes').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code || '';
      openRoutesModal(code);
    });
  });

  els.tbody.querySelectorAll('.btn-protect').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.code || '';
      openPasswordModal(code);
    });
  });

  els.tbody.querySelectorAll('.btn-clear').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.code || '';
      openPasswordModal(code, true);
    });
  });
}

async function load(opts = {}) {
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
      password_protected: Boolean(x.password_protected),
      tags: Array.isArray(x.tags) ? x.tags : [],
      groups: Array.isArray(x.groups) ? x.groups : [],
    }));
    render();
    if (opts.toast) showToast('Links refreshed');
  } catch (err) {
    console.error('Load error:', err);
    els.tbody.innerHTML = `<tr><td class="empty danger" colspan="10">Failed to load links.</td></tr>`;
    if (opts.toast) showToast('Refresh failed', 'error');
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
    renderBulkDomainSelect();
    renderTagSelects();
    renderGroupSelects();
    renderBulkSelects();
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

function renderBulkSelects() {
  if (els.bulkTags) {
    const options = tags.map(t => `<option value="${htmlesc(t.id)}">${htmlesc(t.name)}</option>`);
    els.bulkTags.innerHTML = options.join('');
  }
  if (els.bulkGroup) {
    const options = ['<option value="">No group</option>'].concat(
      groups.map(g => `<option value="${htmlesc(g.id)}">${htmlesc(g.name)}</option>`)
    );
    els.bulkGroup.innerHTML = options.join('');
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
    renderBulkSelects();
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
    renderBulkSelects();
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

async function loadUiMode() {
  try {
    const res = await api('/api/platform-config');
    uiMode = res?.data?.ui_mode === 'expert' ? 'expert' : 'beginner';
  } catch (e) {
    uiMode = 'beginner';
  }
  setUtmWizardMode(uiMode);
}

async function createLink() {
  let url = (els.inUrl.value || '').trim();
  const title = (els.inTitle.value || '').trim();
  const code = (els.inCode.value || '').trim();
  const domain = selectedDomain();
  const password = (els.inPassword?.value || '').trim();
  const deepLinkUrl = (els.inDeepLink?.value || '').trim();
  const iosFallback = (els.inIosFallback?.value || '').trim();
  const androidFallback = (els.inAndroidFallback?.value || '').trim();
  const deepLinkEnabledRaw = (els.inDeepLinkEnabled?.value || 'auto').trim();
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
    if (password) body.password = password;
    if (deepLinkUrl) body.deep_link_url = deepLinkUrl;
    if (iosFallback) body.ios_fallback_url = iosFallback;
    if (androidFallback) body.android_fallback_url = androidFallback;
    if (deepLinkEnabledRaw !== 'auto') body.deep_link_enabled = deepLinkEnabledRaw === 'true';
    const res = unwrap(await api('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
    // Prepend newly created (if API returns a single item)
    await load();
    els.inUrl.value = ''; els.inTitle.value = ''; els.inCode.value = '';
    if (els.inPassword) els.inPassword.value = '';
    if (els.inDeepLink) els.inDeepLink.value = '';
    if (els.inIosFallback) els.inIosFallback.value = '';
    if (els.inAndroidFallback) els.inAndroidFallback.value = '';
    if (els.inDeepLinkEnabled) els.inDeepLinkEnabled.value = 'auto';
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

function parseBulkLines(raw) {
  return raw.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const split = line.includes('|') ? line.split('|') : line.split(',');
    if (split.length > 1) {
      const url = split.shift().trim();
      const title = split.join('|').trim();
      return { url, title: title || null };
    }
    return { url: line, title: null };
  });
}

async function bulkCreate() {
  if (!els.bulkUrls) return;
  const items = parseBulkLines(els.bulkUrls.value || '');
  if (!items.length) {
    if (els.bulkCreateMsg) els.bulkCreateMsg.textContent = 'Paste at least one URL.';
    return;
  }
  const tagIds = Array.from(els.bulkTags?.selectedOptions || []).map(opt => opt.value).filter(Boolean);
  const groupId = (els.bulkGroup?.value || '').trim();
  const domainId = (els.bulkDomain?.value || '').trim();
  const password = (els.bulkPassword?.value || '').trim();
  if (els.bulkCreateBtn) els.bulkCreateBtn.disabled = true;
  if (els.bulkCreateMsg) els.bulkCreateMsg.textContent = 'Creating links...';
  try {
    const res = unwrap(await api('/api/links/bulk-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        domain_id: domainId || null,
        tag_ids: tagIds,
        group_ids: groupId ? [groupId] : [],
        password: password || null,
      }),
    }));
    const successes = (res || []).filter(r => r.success).length;
    const failures = (res || []).filter(r => !r.success);
    if (els.bulkCreateMsg) {
      els.bulkCreateMsg.textContent = `Created ${successes} links${failures.length ? `, ${failures.length} failed` : ''}.`;
    }
    if (failures.length) {
      downloadErrorReport(
        failures.map((r, idx) => ({
          row: r.row || idx + 1,
          url: r.url || '',
          title: r.title || '',
          short_code: r.short_code || '',
          error: r.error || 'Failed',
        })),
        `bulk-create-errors-${Date.now()}.csv`,
      );
    }
    await load();
  } catch (err) {
    if (els.bulkCreateMsg) els.bulkCreateMsg.textContent = `Bulk create failed: ${err.message || err}`;
  } finally {
    if (els.bulkCreateBtn) els.bulkCreateBtn.disabled = false;
  }
}

async function bulkImportCsv() {
  if (!els.bulkCsv || !els.bulkCsv.files || !els.bulkCsv.files.length) {
    if (els.bulkCreateMsg) els.bulkCreateMsg.textContent = 'Select a CSV file to import.';
    return;
  }
  const file = els.bulkCsv.files[0];
  const text = await file.text();
  const tagIds = Array.from(els.bulkTags?.selectedOptions || []).map(opt => opt.value).filter(Boolean);
  const groupId = (els.bulkGroup?.value || '').trim();
  const domainId = (els.bulkDomain?.value || '').trim();
  const password = (els.bulkPassword?.value || '').trim();
  const mode = (els.bulkImportMode?.value || 'append').trim();
  if (els.bulkCreateBtn) els.bulkCreateBtn.disabled = true;
  if (els.bulkCreateMsg) els.bulkCreateMsg.textContent = 'Importing CSV...';
  try {
    const res = unwrap(await api('/api/links/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csv: text,
        domain_id: domainId || null,
        tag_ids: tagIds,
        group_ids: groupId ? [groupId] : [],
        password: password || null,
      }),
    }));
    const successes = (res || []).filter(r => r.success).length;
    const failures = (res || []).filter(r => !r.success);
    if (els.bulkCreateMsg) {
      els.bulkCreateMsg.textContent = `Imported ${successes} links${failures.length ? `, ${failures.length} failed` : ''}.`;
    }
    if (failures.length) {
      downloadErrorReport(
        failures.map((r, idx) => ({
          row: r.row || idx + 1,
          url: r.url || '',
          title: r.title || '',
          short_code: r.short_code || '',
          error: r.error || 'Failed',
        })),
        `bulk-import-errors-${Date.now()}.csv`,
      );
    }
    if (mode === 'replace') {
      els.bulkUrls.value = '';
    }
    await load();
  } catch (err) {
    if (els.bulkCreateMsg) els.bulkCreateMsg.textContent = `CSV import failed: ${err.message || err}`;
  } finally {
    if (els.bulkCreateBtn) els.bulkCreateBtn.disabled = false;
    if (els.bulkCsv) els.bulkCsv.value = '';
  }
}

async function bulkDelete() {
  if (!els.bulkDeleteCodes) return;
  const codes = (els.bulkDeleteCodes.value || '').split('\n').map(c => c.trim()).filter(Boolean);
  if (!codes.length) {
    if (els.bulkDeleteMsg) els.bulkDeleteMsg.textContent = 'Paste at least one code.';
    return;
  }
  if (!confirm(`Delete ${codes.length} links?`)) return;
  if (els.bulkDeleteBtn) els.bulkDeleteBtn.disabled = true;
  if (els.bulkDeleteMsg) els.bulkDeleteMsg.textContent = 'Deleting links...';
  try {
    const res = unwrap(await api('/api/links/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes }),
    }));
    if (els.bulkDeleteMsg) els.bulkDeleteMsg.textContent = `Deleted ${res?.count || 0} links.`;
    await load();
  } catch (err) {
    if (els.bulkDeleteMsg) els.bulkDeleteMsg.textContent = `Bulk delete failed: ${err.message || err}`;
  } finally {
    if (els.bulkDeleteBtn) els.bulkDeleteBtn.disabled = false;
  }
}

function exportCSV() {
  if (!allLinks.length) return;
  if (els.btnExport) {
    els.btnExport.disabled = true;
    els.btnExport.textContent = 'Exporting...';
  }
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
  showToast('Export started');
  setTimeout(() => {
    if (els.btnExport) {
      els.btnExport.disabled = false;
      els.btnExport.textContent = 'Export CSV';
    }
  }, 800);
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

function renderVariantRow(variant = {}) {
  const row = document.createElement('div');
  row.className = 'card';
  row.innerHTML = `
    <label class="muted">URL</label>
    <input class="input variant-url" value="${htmlesc(variant.url || '')}" placeholder="https://example.com/variant">
    <div class="row" style="margin-top:8px">
      <label class="row" style="gap:6px">
        <span class="muted">Weight</span>
        <input class="input variant-weight" type="number" min="1" max="1000" value="${htmlesc(String(variant.weight || 100))}" style="max-width:120px">
      </label>
      <span class="muted small variant-share">0%</span>
      <label class="row" style="gap:6px">
        <input class="variant-active" type="checkbox" ${variant.active !== false ? 'checked' : ''}>
        <span class="muted">Active</span>
      </label>
      <button class="btn danger variant-remove" type="button">Remove</button>
    </div>
  `;
  row.querySelector('.variant-remove').addEventListener('click', () => {
    row.remove();
    updateVariantsSummary();
  });
  row.querySelector('.variant-weight').addEventListener('input', updateVariantsSummary);
  row.querySelector('.variant-active').addEventListener('change', updateVariantsSummary);
  return row;
}

function updateVariantsSummary() {
  if (!els.variantsList) return;
  const rows = Array.from(els.variantsList.querySelectorAll('.card'));
  const weights = rows.map((row) => {
    const active = row.querySelector('.variant-active')?.checked !== false;
    const weight = Number(row.querySelector('.variant-weight')?.value || 0);
    return active ? Math.max(0, weight) : 0;
  });
  const total = weights.reduce((sum, v) => sum + v, 0);
  if (els.variantsTotal) {
    els.variantsTotal.textContent = `Total weight: ${total}`;
    const state = total === 100 ? 'ok' : total ? 'warn' : 'bad';
    els.variantsTotal.className = `status small ${state}`;
  }
  rows.forEach((row, idx) => {
    const share = total > 0 ? Math.round((weights[idx] / total) * 100) : 0;
    const node = row.querySelector('.variant-share');
    if (node) node.textContent = `${share}%`;
  });
}

function normalizeVariants() {
  if (!els.variantsList) return;
  const rows = Array.from(els.variantsList.querySelectorAll('.card'));
  if (!rows.length) return;
  const activeRows = rows.filter(row => row.querySelector('.variant-active')?.checked !== false);
  if (!activeRows.length) return;
  const weights = activeRows.map(row => Number(row.querySelector('.variant-weight')?.value || 0));
  const total = weights.reduce((sum, v) => sum + v, 0) || 1;
  const normalized = weights.map(v => Math.max(1, Math.round((v / total) * 100)));
  const diff = 100 - normalized.reduce((sum, v) => sum + v, 0);
  normalized[0] = Math.max(1, normalized[0] + diff);
  activeRows.forEach((row, idx) => {
    const input = row.querySelector('.variant-weight');
    if (input) input.value = String(normalized[idx]);
  });
  updateVariantsSummary();
}

async function openVariantsModal(code) {
  selectedVariantCode = code;
  if (!els.variantsModal || !els.variantsList) return;
  els.variantsList.innerHTML = '';
  if (els.variantsMsg) els.variantsMsg.textContent = '';
  try {
    const res = unwrap(await api(`/api/links/${encodeURIComponent(code)}/variants`));
    const list = Array.isArray(res) ? res : [];
    if (!list.length) {
      els.variantsList.appendChild(renderVariantRow({}));
    } else {
      list.forEach(v => els.variantsList.appendChild(renderVariantRow(v)));
    }
  } catch (err) {
    els.variantsList.appendChild(renderVariantRow({}));
  }
  updateVariantsSummary();
  els.variantsModal.classList.add('open');
  els.variantsModal.setAttribute('aria-hidden', 'false');
}

function closeVariantsModal() {
  if (!els.variantsModal) return;
  els.variantsModal.classList.remove('open');
  els.variantsModal.setAttribute('aria-hidden', 'true');
  selectedVariantCode = '';
}

function renderRouteRow(route = {}) {
  const row = document.createElement('div');
  row.className = 'card';
  row.setAttribute('data-route-row', 'true');
  row.innerHTML = `
    <div class="grid grid-3">
      <label>
        <span class="muted">Type</span>
        <select class="input route-type">
          <option value="country">Country</option>
          <option value="device">Device</option>
          <option value="platform">Platform</option>
        </select>
      </label>
      <label>
        <span class="muted">Match</span>
        <input class="input route-value" placeholder="US, GB or mobile" value="${htmlesc(route.rule_value || '')}">
      </label>
      <label>
        <span class="muted">Destination</span>
        <input class="input route-url" type="url" placeholder="https://example.com/geo" value="${htmlesc(route.destination_url || '')}">
      </label>
    </div>
    <div class="row" style="margin-top:8px;gap:12px;flex-wrap:wrap">
      <label class="row" style="gap:6px">
        <span class="muted">Priority</span>
        <input class="input route-priority" type="number" min="1" max="1000" value="${htmlesc(String(route.priority || 100))}" style="max-width:120px">
      </label>
      <label class="row" style="gap:6px">
        <input class="route-active" type="checkbox" ${route.active !== false ? 'checked' : ''}>
        <span class="muted">Active</span>
      </label>
      <button class="btn danger route-remove" type="button">Remove</button>
    </div>
  `;
  const typeSelect = row.querySelector('.route-type');
  if (typeSelect && route.rule_type) {
    typeSelect.value = String(route.rule_type).toLowerCase();
  }
  row.querySelector('.route-remove').addEventListener('click', () => row.remove());
  return row;
}

function collectRoutesFromDom() {
  if (!els.routesList) return [];
  const rows = Array.from(els.routesList.querySelectorAll('[data-route-row]'));
  return rows.map((row) => ({
    type: row.querySelector('.route-type')?.value || '',
    value: row.querySelector('.route-value')?.value || '',
    destination_url: row.querySelector('.route-url')?.value || '',
    priority: Number(row.querySelector('.route-priority')?.value || 100),
    active: row.querySelector('.route-active')?.checked !== false,
  }));
}

async function openRoutesModal(code) {
  selectedRouteCode = code;
  if (!els.routesModal || !els.routesList) return;
  els.routesList.innerHTML = '';
  if (els.routesMsg) els.routesMsg.textContent = '';
  try {
    const res = unwrap(await api(`/api/links/${encodeURIComponent(code)}/routes`));
    const list = Array.isArray(res) ? res : [];
    if (!list.length) {
      els.routesList.appendChild(renderRouteRow({}));
    } else {
      list.forEach((r) => els.routesList.appendChild(renderRouteRow(r)));
    }
  } catch (err) {
    els.routesList.appendChild(renderRouteRow({}));
  }
  els.routesModal.classList.add('open');
  els.routesModal.setAttribute('aria-hidden', 'false');
}

function closeRoutesModal() {
  if (!els.routesModal) return;
  els.routesModal.classList.remove('open');
  els.routesModal.setAttribute('aria-hidden', 'true');
  selectedRouteCode = '';
}

async function saveRoutes() {
  if (!selectedRouteCode) return;
  const routes = collectRoutesFromDom().filter(r => r.value.trim() || r.destination_url.trim());
  if (els.routesMsg) els.routesMsg.textContent = '';
  try {
    await api(`/api/links/${encodeURIComponent(selectedRouteCode)}/routes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routes }),
    });
    if (els.routesMsg) els.routesMsg.textContent = 'Routing rules saved.';
    closeRoutesModal();
  } catch (err) {
    if (els.routesMsg) els.routesMsg.textContent = `Save failed: ${err.message || err}`;
  }
}

function openPasswordModal(code, allowClear = false) {
  selectedPasswordCode = code;
  if (!els.passwordModal) return;
  if (els.passwordValue) els.passwordValue.value = '';
  if (els.passwordMsg) els.passwordMsg.textContent = '';
  if (els.passwordClear) els.passwordClear.style.display = allowClear ? 'inline-flex' : 'none';
  els.passwordModal.classList.add('open');
  els.passwordModal.setAttribute('aria-hidden', 'false');
}

function closePasswordModal() {
  if (!els.passwordModal) return;
  els.passwordModal.classList.remove('open');
  els.passwordModal.setAttribute('aria-hidden', 'true');
  selectedPasswordCode = '';
}

async function savePassword() {
  const pw = (els.passwordValue?.value || '').trim();
  if (pw.length < 6) {
    if (els.passwordMsg) els.passwordMsg.textContent = 'Password must be at least 6 characters.';
    return;
  }
  try {
    await api(`/api/links/${encodeURIComponent(selectedPasswordCode)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    await load();
    closePasswordModal();
  } catch (err) {
    if (els.passwordMsg) els.passwordMsg.textContent = `Save failed: ${err.message || err}`;
  }
}

async function clearPassword() {
  if (!selectedPasswordCode) return;
  if (!confirm('Clear password protection for this link?')) return;
  try {
    await api(`/api/links/${encodeURIComponent(selectedPasswordCode)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear_password: true }),
    });
    await load();
    closePasswordModal();
  } catch (err) {
    if (els.passwordMsg) els.passwordMsg.textContent = `Clear failed: ${err.message || err}`;
  }
}

async function saveVariants() {
  if (!selectedVariantCode) return;
  const rows = Array.from(els.variantsList?.querySelectorAll('.card') || []);
  const variants = rows.map((row) => ({
    url: row.querySelector('.variant-url')?.value || '',
    weight: Number(row.querySelector('.variant-weight')?.value || 100),
    active: row.querySelector('.variant-active')?.checked !== false,
  })).filter(v => v.url.trim());
  const total = variants.filter(v => v.active !== false).reduce((sum, v) => sum + (Number(v.weight) || 0), 0);
  if (total !== 100) {
    if (!confirm(`Variant weights total ${total}. Save anyway?`)) return;
  }
  if (els.variantsMsg) els.variantsMsg.textContent = '';
  try {
    await api(`/api/links/${encodeURIComponent(selectedVariantCode)}/variants`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variants }),
    });
    if (els.variantsMsg) els.variantsMsg.textContent = 'Variants saved.';
    closeVariantsModal();
  } catch (err) {
    if (els.variantsMsg) els.variantsMsg.textContent = `Save failed: ${err.message || err}`;
  }
}
function csvCell(v) {
  if (v == null) return '';
  const s = String(v).replaceAll('"','""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

function downloadErrorReport(rows, filename) {
  if (!rows.length) return;
  const header = ['row', 'url', 'title', 'short_code', 'error'];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push(header.map((key) => csvCell(r[key] ?? '')).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
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
els.btnRefresh.addEventListener('click', async () => {
  if (els.btnRefresh) {
    els.btnRefresh.disabled = true;
    els.btnRefresh.textContent = 'Refreshing...';
  }
  await load({ toast: true });
  if (els.btnRefresh) {
    els.btnRefresh.disabled = false;
    els.btnRefresh.textContent = 'Refresh';
  }
});
els.btnExport.addEventListener('click', exportCSV);
els.bulkCreateBtn?.addEventListener('click', bulkCreate);
els.bulkDeleteBtn?.addEventListener('click', bulkDelete);
els.bulkCsv?.addEventListener('change', bulkImportCsv);
els.tagAdd?.addEventListener('click', createTag);
els.groupAdd?.addEventListener('click', createGroup);
utmWizardSteps.forEach((btn) => {
  btn.addEventListener('click', () => setUtmWizardStep(Number(btn.dataset.step) || 1));
});
els.utmWizardPrev?.addEventListener('click', () => setUtmWizardStep(utmWizardStep - 1));
els.utmWizardNext?.addEventListener('click', () => setUtmWizardStep(utmWizardStep + 1));
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
setUtmWizardMode('beginner');
setUtmWizardStep(1);
loadUiMode();
els.qrClose?.addEventListener('click', closeQrModal);
els.qrBackdrop?.addEventListener('click', closeQrModal);
els.variantsClose?.addEventListener('click', closeVariantsModal);
els.variantsBackdrop?.addEventListener('click', closeVariantsModal);
els.variantAdd?.addEventListener('click', () => {
  if (els.variantsList) els.variantsList.appendChild(renderVariantRow({}));
  updateVariantsSummary();
});
els.variantsSave?.addEventListener('click', saveVariants);
els.variantsNormalize?.addEventListener('click', normalizeVariants);
els.routesClose?.addEventListener('click', closeRoutesModal);
els.routesBackdrop?.addEventListener('click', closeRoutesModal);
els.routeAdd?.addEventListener('click', () => {
  if (els.routesList) els.routesList.appendChild(renderRouteRow({}));
});
els.routesSave?.addEventListener('click', saveRoutes);
els.passwordClose?.addEventListener('click', closePasswordModal);
els.passwordBackdrop?.addEventListener('click', closePasswordModal);
els.passwordSave?.addEventListener('click', savePassword);
els.passwordClear?.addEventListener('click', clearPassword);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeQrModal();
    closeVariantsModal();
    closeRoutesModal();
    closePasswordModal();
  }
});

// Go
loadContext();
load();
updateUtmPreview();

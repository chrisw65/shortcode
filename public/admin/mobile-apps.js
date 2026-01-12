import { apiFetch, showToast, showError, htmlesc } from './admin-common.js';

const els = {
  mobileName: document.getElementById('mobileName'),
  mobilePlatform: document.getElementById('mobilePlatform'),
  mobileBundleId: document.getElementById('mobileBundleId'),
  mobilePackageName: document.getElementById('mobilePackageName'),
  mobileStoreUrl: document.getElementById('mobileStoreUrl'),
  mobileScheme: document.getElementById('mobileScheme'),
  mobileUniversalDomain: document.getElementById('mobileUniversalDomain'),
  mobileActive: document.getElementById('mobileActive'),
  mobileSave: document.getElementById('mobileSave'),
  mobileSaveMsg: document.getElementById('mobileSaveMsg'),
  mobileRefresh: document.getElementById('mobileRefresh'),
  mobileList: document.getElementById('mobileList'),
  mobileListMsg: document.getElementById('mobileListMsg'),
};

let apps = [];
let editingId = null;

function clearForm() {
  editingId = null;
  if (els.mobileName) els.mobileName.value = '';
  if (els.mobilePlatform) els.mobilePlatform.value = 'ios';
  if (els.mobileBundleId) els.mobileBundleId.value = '';
  if (els.mobilePackageName) els.mobilePackageName.value = '';
  if (els.mobileStoreUrl) els.mobileStoreUrl.value = '';
  if (els.mobileScheme) els.mobileScheme.value = '';
  if (els.mobileUniversalDomain) els.mobileUniversalDomain.value = '';
  if (els.mobileActive) els.mobileActive.checked = true;
}

function renderList() {
  if (!els.mobileList) return;
  if (!apps.length) {
    els.mobileList.innerHTML = '<div class="muted">No apps registered.</div>';
    return;
  }
  els.mobileList.innerHTML = apps.map((app) => `
    <div class="card">
      <div class="row-between">
        <div>
          <div style="font-weight:600">${htmlesc(app.name || '')}</div>
          <div class="muted small">${htmlesc(app.platform)} · ${app.is_active ? 'Active' : 'Inactive'}</div>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn ghost" data-action="edit" data-id="${htmlesc(app.id)}">Edit</button>
          <button class="btn danger" data-action="delete" data-id="${htmlesc(app.id)}">Delete</button>
        </div>
      </div>
      <div class="muted small" style="margin-top:8px">
        ${app.scheme ? `Scheme: ${htmlesc(app.scheme)} · ` : ''}
        ${app.universal_link_domain ? `Universal: ${htmlesc(app.universal_link_domain)}` : ''}
      </div>
    </div>
  `).join('');

  els.mobileList.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => selectApp(btn.dataset.id));
  });
  els.mobileList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => deleteApp(btn.dataset.id));
  });
}

async function loadApps() {
  if (els.mobileListMsg) els.mobileListMsg.textContent = '';
  try {
    const res = await apiFetch('/api/mobile-apps');
    apps = res?.data || [];
    renderList();
  } catch (err) {
    if (els.mobileListMsg) els.mobileListMsg.textContent = 'Failed to load apps.';
    showError(err, 'Failed to load apps');
  }
}

function selectApp(id) {
  const app = apps.find((a) => a.id === id);
  if (!app) return;
  editingId = app.id;
  if (els.mobileName) els.mobileName.value = app.name || '';
  if (els.mobilePlatform) els.mobilePlatform.value = app.platform || 'ios';
  if (els.mobileBundleId) els.mobileBundleId.value = app.bundle_id || '';
  if (els.mobilePackageName) els.mobilePackageName.value = app.package_name || '';
  if (els.mobileStoreUrl) els.mobileStoreUrl.value = app.app_store_url || '';
  if (els.mobileScheme) els.mobileScheme.value = app.scheme || '';
  if (els.mobileUniversalDomain) els.mobileUniversalDomain.value = app.universal_link_domain || '';
  if (els.mobileActive) els.mobileActive.checked = app.is_active !== false;
}

function collectPayload() {
  return {
    name: els.mobileName?.value.trim() || '',
    platform: els.mobilePlatform?.value || 'ios',
    bundle_id: els.mobileBundleId?.value.trim() || '',
    package_name: els.mobilePackageName?.value.trim() || '',
    app_store_url: els.mobileStoreUrl?.value.trim() || '',
    scheme: els.mobileScheme?.value.trim() || '',
    universal_link_domain: els.mobileUniversalDomain?.value.trim() || '',
    is_active: els.mobileActive?.checked !== false,
  };
}

async function saveApp() {
  if (els.mobileSave) els.mobileSave.disabled = true;
  if (els.mobileSaveMsg) els.mobileSaveMsg.textContent = '';
  const payload = collectPayload();
  try {
    if (editingId) {
      await apiFetch(`/api/mobile-apps/${encodeURIComponent(editingId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showToast('App updated');
    } else {
      await apiFetch('/api/mobile-apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showToast('App created');
    }
    clearForm();
    await loadApps();
  } catch (err) {
    if (els.mobileSaveMsg) els.mobileSaveMsg.textContent = 'Failed to save app.';
    showError(err, 'Failed to save app');
  } finally {
    if (els.mobileSave) els.mobileSave.disabled = false;
  }
}

async function deleteApp(id) {
  if (!id) return;
  if (!confirm('Delete this app?')) return;
  try {
    await apiFetch(`/api/mobile-apps/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast('App deleted');
    if (editingId === id) clearForm();
    await loadApps();
  } catch (err) {
    showError(err, 'Failed to delete app');
  }
}

els.mobileSave?.addEventListener('click', saveApp);
els.mobileRefresh?.addEventListener('click', loadApps);

loadApps();
clearForm();

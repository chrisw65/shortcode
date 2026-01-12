import { requireAuth, api, apiPost, htmlesc, showToast, copyToClipboard } from '/admin/admin-common.js?v=20260120';

requireAuth();

const keysBody = document.getElementById('keysBody');
const keyName = document.getElementById('keyName');
const btnCreate = document.getElementById('btnCreate');
const keyMsg = document.getElementById('keyMsg');
const customScopes = document.getElementById('customScopes');
const keyReveal = document.getElementById('keyReveal');
const keyValue = document.getElementById('keyValue');
const copyKeyBtn = document.getElementById('copyKeyBtn');

const scopeGrid = document.getElementById('scopeGrid');

function getSelectedScopes() {
  const custom = (customScopes?.value || '').trim();
  if (custom) {
    return custom.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const selected = Array.from(scopeGrid?.querySelectorAll('input[type="checkbox"]') || [])
    .filter((input) => input.checked)
    .map((input) => input.dataset.scope)
    .filter(Boolean);
  if (selected.includes('*')) return ['*'];
  return selected;
}

function syncScopeUI() {
  const custom = (customScopes?.value || '').trim();
  const inputs = Array.from(scopeGrid?.querySelectorAll('input[type="checkbox"]') || []);
  if (custom) {
    inputs.forEach((input) => { input.checked = false; });
    return;
  }
  const full = scopeGrid?.querySelector('input[data-scope="*"]');
  if (full?.checked) {
    inputs.forEach((input) => {
      if (input.dataset.scope !== '*') input.checked = false;
    });
  }
}

async function loadKeys() {
  try {
    const res = await api('/api/api-keys');
    const data = res?.data || res;
    if (!Array.isArray(data) || !data.length) {
      keysBody.innerHTML = '<tr><td class="empty" colspan="7">No keys yet.</td></tr>';
      return;
    }
    keysBody.innerHTML = data.map((k) => `
      <tr data-id="${htmlesc(k.id)}">
        <td>${htmlesc(k.name || '')}</td>
        <td><span class="pill">${htmlesc(k.prefix)}</span></td>
        <td>${htmlesc(Array.isArray(k.scopes) ? k.scopes.join(', ') : (k.scopes || ''))}</td>
        <td>${k.created_at ? new Date(k.created_at).toLocaleString() : '—'}</td>
        <td>${k.last_used_at ? new Date(k.last_used_at).toLocaleString() : '—'}</td>
        <td>${k.revoked_at ? 'Revoked' : 'Active'}</td>
        <td style="text-align:right">
          <button class="btn danger btn-revoke" ${k.revoked_at ? 'disabled' : ''}>Revoke</button>
        </td>
      </tr>
    `).join('');

    keysBody.querySelectorAll('.btn-revoke').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const tr = e.currentTarget.closest('tr');
        const id = tr?.dataset.id;
        if (!id) return;
        if (!confirm('Revoke this API key?')) return;
        try {
          await api(`/api/api-keys/${encodeURIComponent(id)}/revoke`, { method: 'POST' });
          await loadKeys();
        } catch (err) {
          alert(err?.message || 'Failed to revoke key');
        }
      });
    });
  } catch (e) {
    keysBody.innerHTML = '<tr><td class="empty" colspan="5">Failed to load keys.</td></tr>';
  }
}

async function createKey() {
  const name = (keyName.value || '').trim();
  const scopes = getSelectedScopes();
  keyMsg.textContent = '';
  if (!name) {
    keyMsg.textContent = 'Name is required.';
    return;
  }
  if (!scopes.length) {
    keyMsg.textContent = 'Select at least one scope.';
    return;
  }
  btnCreate.disabled = true;
  try {
    const res = await apiPost('/api/api-keys', { name, scopes });
    const data = res?.data || res;
    if (data?.api_key) {
      if (keyValue) keyValue.textContent = data.api_key;
      if (keyReveal) keyReveal.style.display = 'block';
      keyMsg.textContent = '';
      showToast('API key generated. Copy it now.');
    } else {
      keyMsg.textContent = 'Key created.';
    }
    keyName.value = '';
    if (customScopes) customScopes.value = '';
    await loadKeys();
  } catch (err) {
    keyMsg.textContent = err?.message || 'Failed to create key.';
  } finally {
    btnCreate.disabled = false;
  }
}

btnCreate?.addEventListener('click', createKey);
copyKeyBtn?.addEventListener('click', () => {
  const value = keyValue?.textContent || '';
  if (!value) return;
  copyToClipboard(value);
});
customScopes?.addEventListener('input', syncScopeUI);
scopeGrid?.addEventListener('change', (e) => {
  if (e.target?.dataset?.scope === '*') {
    syncScopeUI();
    return;
  }
  const full = scopeGrid.querySelector('input[data-scope="*"]');
  if (full) full.checked = false;
});
loadKeys();

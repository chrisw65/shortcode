import { requireAuth, api, htmlesc } from '/admin/admin-common.js?v=20260112';

requireAuth();

const keysBody = document.getElementById('keysBody');
const keyName = document.getElementById('keyName');
const keyScopes = document.getElementById('keyScopes');
const btnCreate = document.getElementById('btnCreate');
const keyMsg = document.getElementById('keyMsg');

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
  const scopesRaw = (keyScopes?.value || '').trim();
  const scopes = scopesRaw ? scopesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  keyMsg.textContent = '';
  if (!name) {
    keyMsg.textContent = 'Name is required.';
    return;
  }
  btnCreate.disabled = true;
  try {
    const res = await api('/api/api-keys', { method: 'POST', body: { name, scopes } });
    const data = res?.data || res;
    if (data?.api_key) {
      keyMsg.textContent = `New API key (copy now): ${data.api_key}`;
    } else {
      keyMsg.textContent = 'Key created.';
    }
    keyName.value = '';
    if (keyScopes) keyScopes.value = '';
    await loadKeys();
  } catch (err) {
    keyMsg.textContent = err?.message || 'Failed to create key.';
  } finally {
    btnCreate.disabled = false;
  }
}

btnCreate?.addEventListener('click', createKey);
loadKeys();

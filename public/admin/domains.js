import { requireAuth, api, mountNav, htmlesc } from '/admin/admin-common.js';

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  mountNav('domains');

  const domainEl = document.getElementById('domain');
  const addBtn   = document.getElementById('addBtn');
  const addMsg   = document.getElementById('addMsg');
  const tbody    = document.getElementById('tbody');

  // Hard assertions with helpful console output
  if (!domainEl || !addBtn || !addMsg || !tbody) {
    console.error('domains.js: missing required DOM nodes', {
      domainEl: !!domainEl, addBtn: !!addBtn, addMsg: !!addMsg, tbody: !!tbody
    });
    // Avoid throwing; show a user-facing error row if tbody exists
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" class="danger">DOM error: reload page (⌘⇧R).</td></tr>';
    }
    return;
  }

  let list = [];

  async function load() {
    try {
      const j = await api('/api/domains');
      list = Array.isArray(j.data) ? j.data : [];
      render();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="danger">Failed to load: ${htmlesc(e.message || 'unknown')}</td></tr>`;
    }
  }

  function render() {
    tbody.innerHTML = '';
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No domains.</td></tr>';
      return;
    }

    for (const d of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${htmlesc(d.domain)}</td>
        <td>${d.verified ? '<span class="badge">Verified</span>' : '<span class="badge">Pending</span>'}</td>
        <td style="text-align:center">${d.is_default ? '✅' : ''}</td>
        <td><code>${htmlesc(d.verification_token || '')}</code></td>
        <td class="row" style="justify-content:end;gap:8px">
          ${!d.verified ? `<button class="btn" data-act="check" data-id="${htmlesc(d.id)}">Verify</button>` : ''}
          ${!d.is_default ? `<button class="btn" data-act="default" data-id="${htmlesc(d.id)}">Make default</button>` : ''}
          <button class="btn" data-act="delete" data-id="${htmlesc(d.id)}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    // Bind actions
    tbody.querySelectorAll('button[data-act]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.id;
        try {
          if (b.dataset.act === 'check') {
            await api(`/api/domains/${id}/verify`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) });
            await load();
          } else if (b.dataset.act === 'default') {
            await api(`/api/domains/${id}/default`, { method: 'POST' });
            await load();
          } else if (b.dataset.act === 'delete') {
            if (!confirm('Delete domain?')) return;
            await api(`/api/domains/${id}`, { method: 'DELETE' });
            list = list.filter(x => x.id !== id);
            render();
          }
        } catch (e) {
          alert((b.dataset.act || 'Action') + ' failed: ' + (e.message || 'unknown'));
        }
      });
    });
  }

  async function add() {
    addMsg.textContent = '';
    const domain = (domainEl.value || '').trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
      addMsg.textContent = 'Enter a valid domain';
      return;
    }
    addBtn.disabled = true;
    try {
      const j = await api('/api/domains', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ domain, make_default: false })
      });
      list.unshift(j.data);
      render();
      alert(`Add TXT record:\n_host: _shortlink.${domain}\n_value: ${j.data.verification_token}`);
      domainEl.value = '';
    } catch (e) {
      addMsg.textContent = e.message || 'Add failed';
    } finally {
      addBtn.disabled = false;
    }
  }

  addBtn.addEventListener('click', add);
  load();
});


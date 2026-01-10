import { requireAuth, apiFetch, showError } from '/admin/admin-common.js?v=20260120';

requireAuth();

const rowsEl = document.getElementById('auditRows');
const metaEl = document.getElementById('auditMeta');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');
const exportBtn = document.getElementById('exportBtn');
const refreshBtn = document.getElementById('auditRefresh');
const actionFilterEl = document.getElementById('auditActionFilter');
const searchInputEl = document.getElementById('auditSearch');
const applyFiltersBtn = document.getElementById('auditApplyFilters');
const clearFiltersBtn = document.getElementById('auditClearFilters');
const totalEl = document.getElementById('auditTotal');
const limitEl = document.getElementById('auditPageLimit');
const lastEventEl = document.getElementById('auditLastEvent');

let state = { offset: 0, limit: 50, total: 0, action: '', query: '' };

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

const esc = (value) => String(value || '').replace(/[&<>"']/g, (c) => (
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[c])
));

const matchesQuery = (row, query = '') => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const fields = [
    row.action,
    row.user_email,
    row.user_name,
    row.entity_type,
    row.entity_id,
    row.metadata ? JSON.stringify(row.metadata) : '',
  ];
  return fields.some((value) => String(value || '').toLowerCase().includes(needle));
};

const updateActionOptions = (rows) => {
  if (!actionFilterEl) return;
  const prev = actionFilterEl.value;
  const actions = Array.from(new Set(rows
    .map((row) => row.action)
    .filter((value) => value)
  )).sort();
  actionFilterEl.innerHTML = '<option value="">All actions</option>' + actions.map((action) => (
    `<option value="${action}">${action}</option>`
  )).join('');
  if (prev && actions.includes(prev)) {
    actionFilterEl.value = prev;
  } else {
    actionFilterEl.value = '';
    state.action = '';
  }
};

async function loadAudit() {
  try {
    const res = await apiFetch(`/api/org/audit?limit=${state.limit}&offset=${state.offset}`);
    const data = res?.data || [];
    const meta = res?.meta || { total: data.length, limit: state.limit, offset: state.offset };
    updateActionOptions(data);
    state.total = meta.total || 0;
    const filtered = data
      .filter((row) => (!state.action || row.action === state.action))
      .filter((row) => matchesQuery(row, state.query));
    rowsEl.innerHTML = filtered.map((row) => {
      const user = row.user_email || row.user_name || 'System';
      const entity = `${row.entity_type || ''}${row.entity_id ? `:${row.entity_id}` : ''}`;
      const details = row.metadata ? JSON.stringify(row.metadata) : '';
      return `
        <tr>
          <td>${esc(fmtDate(row.created_at))}</td>
          <td>${esc(row.action)}</td>
          <td>${esc(user)}</td>
          <td>${esc(entity)}</td>
          <td class="muted">${esc(details)}</td>
        </tr>
      `;
    }).join('') || '<tr><td class="empty" colspan="5">No events match the filters.</td></tr>';
    const from = meta.offset + 1;
    const to = Math.min(meta.offset + meta.limit, meta.total);
    const filteredCount = filtered.length;
    metaEl.textContent = meta.total
      ? `Showing ${from}-${to} of ${meta.total}${state.action || state.query ? ` (${filteredCount} displayed)` : ''}`
      : 'No activity yet';
    prevBtn.disabled = state.offset === 0;
    nextBtn.disabled = state.offset + state.limit >= state.total;
    if (totalEl) totalEl.textContent = String(meta.total || 0);
    if (limitEl) limitEl.textContent = String(meta.limit || state.limit);
    if (lastEventEl) {
      lastEventEl.textContent = data.length ? fmtDate(data[0].created_at) : '—';
    }
  } catch (err) {
    showError(err, 'Failed to load audit logs');
  }
}

prevBtn.addEventListener('click', () => {
  state.offset = Math.max(0, state.offset - state.limit);
  loadAudit();
});
nextBtn.addEventListener('click', () => {
  state.offset = state.offset + state.limit;
  loadAudit();
});
exportBtn.addEventListener('click', () => {
  window.location.href = '/api/org/audit/export';
});
refreshBtn.addEventListener('click', () => {
  loadAudit();
});
applyFiltersBtn.addEventListener('click', () => {
  state.action = actionFilterEl.value;
  state.query = searchInputEl.value || '';
  state.offset = 0;
  loadAudit();
});
clearFiltersBtn.addEventListener('click', () => {
  state.action = '';
  state.query = '';
  actionFilterEl.value = '';
  searchInputEl.value = '';
  state.offset = 0;
  loadAudit();
});

loadAudit();

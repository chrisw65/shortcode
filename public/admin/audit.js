import { requireAuth, apiFetch, showError } from '/admin/admin-common.js?v=20260112';

requireAuth();

const rowsEl = document.getElementById('auditRows');
const metaEl = document.getElementById('auditMeta');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');
const exportBtn = document.getElementById('exportBtn');

let state = { offset: 0, limit: 50, total: 0 };

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

const esc = (value) => String(value || '').replace(/[&<>"']/g, (c) => (
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[c])
));

async function loadAudit() {
  try {
    const res = await apiFetch(`/api/org/audit?limit=${state.limit}&offset=${state.offset}`);
    const data = res?.data || [];
    const meta = res?.meta || { total: data.length, limit: state.limit, offset: state.offset };
    state.total = meta.total || 0;
    rowsEl.innerHTML = data.map((row) => {
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
    }).join('');
    const from = meta.offset + 1;
    const to = Math.min(meta.offset + meta.limit, meta.total);
    metaEl.textContent = meta.total ? `Showing ${from}-${to} of ${meta.total}` : 'No activity yet';
    prevBtn.disabled = state.offset === 0;
    nextBtn.disabled = state.offset + state.limit >= state.total;
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

loadAudit();

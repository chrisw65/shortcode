// v9 – minimal, safe dashboard data loader with proper nav mounting
import { requireAuth, apiFetch, fmtDate, mountNav, $, $$ } from '/admin/admin-common.js?v=20260120';

requireAuth();
mountNav('dashboard');

const statTotalLinks = $('#stat-total-links');
const statTotalClicks = $('#stat-total-clicks');
const statClicks24h  = $('#stat-clicks-24h');
const statLastClick  = $('#stat-last-click');
const sideBody       = $('#side-body');
const sideFilter     = $('#side-filter');
const sideRefresh    = $('#side-refresh');
const topTableBody   = $('#top-table-body');

function setText(el, text) { if (el) el.textContent = text; }

async function loadLinksList(query = '') {
  // Simple list of links for the side panel
  const data = await apiFetch('/api/links');
  const items = Array.isArray(data?.data) ? data.data : [];

  const rows = items
    .filter(l =>
      !query ||
      (l.title && l.title.toLowerCase().includes(query.toLowerCase())) ||
      (l.short_code && l.short_code.toLowerCase().includes(query.toLowerCase()))
    )
    .slice(0, 20)
    .map(l => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${escapeHtml(l.short_code)}</code></td>
        <td>${l.title ? escapeHtml(l.title) : '—'}</td>
        <td>${l.click_count ?? 0}</td>
        <td>${fmtDate(l.created_at)}</td>
      `;
      return tr;
    });

  sideBody.innerHTML = '';
  if (!rows.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" class="muted">No links.</td>`;
    sideBody.appendChild(tr);
  } else {
    rows.forEach(r => sideBody.appendChild(r));
  }

  // Overview counters
  const totalLinks = items.length;
  const totalClicks = items.reduce((n, l) => n + (l.click_count || 0), 0);
  setText(statTotalLinks, String(totalLinks));
  setText(statTotalClicks, String(totalClicks));

  // clicks last 24h via analytics endpoint (if present)
  try {
    const a = await apiFetch('/api/analytics/summary');
    setText(statClicks24h, String(a?.data?.clicks_24h ?? 0));
    setText(statLastClick, a?.data?.last_click_at ? fmtDate(a.data.last_click_at) : '—');
  } catch {
    setText(statClicks24h, '—');
    setText(statLastClick, '—');
  }

  // Top links (by clicks)
  const top = [...items].sort((a,b) => (b.click_count||0)-(a.click_count||0)).slice(0,10);
  topTableBody.innerHTML = '';
  if (!top.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="muted">No data.</td>`;
    topTableBody.appendChild(tr);
  } else {
    top.forEach(l => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${escapeHtml(l.short_code)}</code></td>
        <td>${l.title ? escapeHtml(l.title) : '—'}</td>
        <td>${l.click_count ?? 0}</td>
        <td>—</td>
        <td>—</td>
        <td><a href="https://${(l.short_url || '').split('/')[2] || location.host}/${l.short_code}" target="_blank" rel="noopener">Open</a></td>
      `;
      topTableBody.appendChild(tr);
    });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

sideRefresh?.addEventListener('click', () => loadLinksList(sideFilter?.value || ''));
sideFilter?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadLinksList(sideFilter.value || ''); });

// initial load
loadLinksList().catch(err => {
  console.error('dashboard load error:', err);
  alert('Failed to load dashboard. Check console for details.');
});

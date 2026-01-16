import { requireAuth, apiFetch, onReady, $, showToast, showError, escapeHtml, formatDateTime } from './admin-common.js';

const orgTableBody = $('#orgTableBody');
const orgSearch = $('#orgSearch');
const orgStatusFilter = $('#orgStatusFilter');
const orgBillingFilter = $('#orgBillingFilter');
const reloadOrgs = $('#reloadOrgs');
const loadMoreOrgs = $('#loadMoreOrgs');
const orgMsg = $('#orgMsg');
const orgMeta = $('#orgMeta');

const orgModal = $('#orgModal');
const orgModalTitle = $('#orgModalTitle');
const orgModalSubtitle = $('#orgModalSubtitle');
const orgStatusText = $('#orgStatusText');
const orgSuspendReason = $('#orgSuspendReason');
const orgToggleStatus = $('#orgToggleStatus');
const orgStatusMsg = $('#orgStatusMsg');
const orgPlanSelect = $('#orgPlanSelect');
const orgPlanDuration = $('#orgPlanDuration');
const orgPlanReason = $('#orgPlanReason');
const orgSavePlan = $('#orgSavePlan');
const orgPlanMsg = $('#orgPlanMsg');
const orgMembersBody = $('#orgMembersBody');
const orgMembersMeta = $('#orgMembersMeta');

const state = {
  orgs: [],
  map: new Map(),
  offset: 0,
  limit: 50,
  query: '',
  loading: false,
  hasMore: true,
  planOptions: [],
  selectedOrgId: '',
};

function planIdForTier(tier) {
  if (tier.id) return tier.id;
  return (tier.name || 'plan')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function loadPlanOptions() {
  try {
    const res = await fetch('/api/public/site-config', { credentials: 'same-origin' });
    const data = await res.json();
    const tiers = Array.isArray(data?.data?.pricing?.tiers) ? data.data.pricing.tiers : [];
    state.planOptions = tiers.map((tier) => ({
      id: planIdForTier(tier),
      name: tier.name || tier.id || planIdForTier(tier),
    }));
  } catch {
    state.planOptions = [];
  }
  if (!state.planOptions.length) {
    state.planOptions = [
      { id: 'free', name: 'Free' },
      { id: 'pro', name: 'Pro' },
      { id: 'enterprise', name: 'Enterprise' },
    ];
  }
}

function renderPlanSelect(selected) {
  if (!orgPlanSelect) return;
  orgPlanSelect.innerHTML = state.planOptions.map((opt) => (
    `<option value="${escapeHtml(opt.id)}">${escapeHtml(opt.name)}</option>`
  )).join('');
  if (selected) orgPlanSelect.value = selected;
}

function billingLabel(org) {
  if (org.billing_paid) return { text: 'Paid', cls: 'status ok' };
  if (org.billing_status === 'trialing') return { text: 'Trial', cls: 'status warn' };
  if (org.billing_status && org.billing_status !== 'none') return { text: org.billing_status, cls: 'status bad' };
  return { text: 'Unpaid', cls: 'status bad' };
}

function orgStatusLabel(org) {
  if (org.is_active === false) return { text: 'Suspended', cls: 'status bad' };
  return { text: 'Active', cls: 'status ok' };
}

function matchesFilters(org) {
  const status = orgStatusFilter?.value || 'all';
  const billing = orgBillingFilter?.value || 'all';
  if (status === 'active' && org.is_active === false) return false;
  if (status === 'suspended' && org.is_active !== false) return false;
  if (billing === 'paid' && !org.billing_paid) return false;
  if (billing === 'unpaid' && org.billing_paid) return false;
  return true;
}

function renderTable() {
  if (!orgTableBody) return;
  const filtered = state.orgs.filter(matchesFilters);
  orgMeta.textContent = `${filtered.length} orgs loaded`;
  if (!filtered.length) {
    orgTableBody.innerHTML = '<tr><td colspan="8" class="muted">No organizations found.</td></tr>';
    return;
  }
  orgTableBody.innerHTML = '';
  filtered.forEach((org) => {
    const billing = billingLabel(org);
    const status = orgStatusLabel(org);
    const usage = `${org.users_count ?? 0} users • ${org.links_count ?? 0} links • ${org.domains_count ?? 0} domains`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="font-weight:600">${escapeHtml(org.name || 'Untitled')}</div>
        <div class="muted small">${escapeHtml(org.id)}</div>
      </td>
      <td>
        <div>${escapeHtml(org.owner?.email || '—')}</div>
        <div class="muted small">${escapeHtml(org.owner?.name || '')}</div>
      </td>
      <td>${escapeHtml(org.plan || 'free')}</td>
      <td>${escapeHtml(usage)}</td>
      <td><span class="${billing.cls}">${escapeHtml(billing.text)}</span></td>
      <td><span class="${status.cls}">${escapeHtml(status.text)}</span></td>
      <td>${formatDateTime(org.last_click_at)}</td>
      <td><button class="btn ghost" data-action="manage" data-id="${escapeHtml(org.id)}">Manage</button></td>
    `;
    orgTableBody.appendChild(tr);
  });
}

async function loadOrgs({ reset = false } = {}) {
  if (state.loading || !state.hasMore && !reset) return;
  state.loading = true;
  orgMsg.textContent = 'Loading...';
  if (reset) {
    state.offset = 0;
    state.hasMore = true;
    state.orgs = [];
    state.map.clear();
    orgTableBody.innerHTML = '<tr><td colspan="8" class="muted">Loading...</td></tr>';
  }
  try {
    const q = encodeURIComponent(state.query || '');
    const res = await apiFetch(`/api/admin/orgs?limit=${state.limit}&offset=${state.offset}&q=${q}`);
    const data = res?.data || [];
    if (Array.isArray(data)) {
      data.forEach((org) => {
        state.map.set(org.id, org);
        state.orgs.push(org);
      });
      state.offset += data.length;
      if (data.length < state.limit) state.hasMore = false;
    }
    renderTable();
    orgMsg.textContent = state.hasMore ? '' : 'End of list.';
  } catch (err) {
    orgMsg.textContent = 'Failed to load orgs.';
    showError(err);
  } finally {
    state.loading = false;
  }
}

function openModal() {
  if (orgModal) orgModal.classList.add('open');
}

function closeModal() {
  if (orgModal) orgModal.classList.remove('open');
  state.selectedOrgId = '';
  orgStatusMsg.textContent = '';
  orgPlanMsg.textContent = '';
}

async function openOrgModal(orgId) {
  if (!orgId) return;
  state.selectedOrgId = orgId;
  orgMembersBody.innerHTML = '<tr><td colspan="4" class="muted">Loading...</td></tr>';
  orgStatusMsg.textContent = '';
  orgPlanMsg.textContent = '';
  openModal();
  try {
    const res = await apiFetch(`/api/admin/orgs/${orgId}`);
    const orgDetail = res?.data || {};
    const listRow = state.map.get(orgId) || {};
    const plan = listRow.plan || orgDetail.plan || 'free';
    const status = orgStatusLabel(listRow);
    orgModalTitle.textContent = orgDetail.name || listRow.name || 'Organization';
    orgModalSubtitle.textContent = `${orgId} • ${orgDetail.owner?.email || listRow.owner?.email || ''}`;
    orgStatusText.textContent = `${status.text} • Plan ${plan}`;
    orgSuspendReason.value = listRow.suspended_reason || orgDetail.suspended_reason || '';
    orgToggleStatus.textContent = listRow.is_active === false ? 'Resume org' : 'Suspend org';
    renderPlanSelect(plan);
    orgPlanDuration.value = '';
    orgPlanReason.value = 'admin_override';

    const members = Array.isArray(orgDetail.members) ? orgDetail.members : [];
    orgMembersMeta.textContent = `${members.length} members`;
    if (!members.length) {
      orgMembersBody.innerHTML = '<tr><td colspan="4" class="muted">No members found.</td></tr>';
    } else {
      orgMembersBody.innerHTML = '';
      members.forEach((member) => {
        const active = member.is_active !== false;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div>${escapeHtml(member.email || '')}</div>
            <div class="muted small">${escapeHtml(member.name || '')}</div>
          </td>
          <td>${escapeHtml(member.role || '')}</td>
          <td><span class="status ${active ? 'ok' : 'bad'}">${active ? 'Active' : 'Disabled'}</span></td>
          <td>
            <button class="btn ghost" data-action="toggle-user" data-id="${escapeHtml(member.user_id)}">
              ${active ? 'Disable' : 'Enable'}
            </button>
          </td>
        `;
        orgMembersBody.appendChild(tr);
      });
    }
  } catch (err) {
    showError(err);
    closeModal();
  }
}

async function toggleOrgStatus() {
  const orgId = state.selectedOrgId;
  if (!orgId) return;
  const org = state.map.get(orgId);
  const nextActive = org?.is_active === false;
  orgStatusMsg.textContent = 'Saving...';
  try {
    const reason = orgSuspendReason.value.trim();
    await apiFetch(`/api/admin/orgs/${orgId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: nextActive, reason }),
    });
    const updated = { ...(org || {}), is_active: nextActive, suspended_reason: nextActive ? null : reason };
    state.map.set(orgId, updated);
    state.orgs = state.orgs.map((row) => (row.id === orgId ? updated : row));
    renderTable();
    orgToggleStatus.textContent = nextActive ? 'Suspend org' : 'Resume org';
    orgStatusMsg.textContent = nextActive ? 'Org reactivated.' : 'Org suspended.';
  } catch (err) {
    orgStatusMsg.textContent = 'Failed to update status.';
    showError(err);
  }
}

async function applyOrgPlan() {
  const orgId = state.selectedOrgId;
  if (!orgId) return;
  const plan = orgPlanSelect.value;
  if (!plan) return;
  const durationMonths = Number(orgPlanDuration.value || 0);
  const reason = orgPlanReason.value.trim() || 'admin_override';
  orgPlanMsg.textContent = 'Saving...';
  try {
    await apiFetch(`/api/admin/orgs/${orgId}/plan`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, duration_months: durationMonths, reason }),
    });
    const org = state.map.get(orgId);
    const updated = { ...(org || {}), plan };
    state.map.set(orgId, updated);
    state.orgs = state.orgs.map((row) => (row.id === orgId ? updated : row));
    renderTable();
    orgPlanMsg.textContent = 'Plan updated.';
  } catch (err) {
    orgPlanMsg.textContent = 'Failed to update plan.';
    showError(err);
  }
}

async function toggleUserStatus(userId) {
  const orgId = state.selectedOrgId;
  if (!orgId || !userId) return;
  const btn = orgMembersBody.querySelector(`button[data-action="toggle-user"][data-id="${userId}"]`);
  if (!btn) return;
  const row = btn.closest('tr');
  if (!row) return;
  const isDisabling = btn.textContent.trim().toLowerCase() === 'disable';
  btn.disabled = true;
  try {
    await apiFetch(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isDisabling }),
    });
    btn.textContent = isDisabling ? 'Enable' : 'Disable';
    const statusCell = row.querySelector('.status');
    if (statusCell) {
      statusCell.textContent = isDisabling ? 'Disabled' : 'Active';
      statusCell.className = `status ${isDisabling ? 'bad' : 'ok'}`;
    }
  } catch (err) {
    showError(err);
  } finally {
    btn.disabled = false;
  }
}

function bindEvents() {
  if (orgSearch) {
    let searchTimer;
    orgSearch.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = orgSearch.value.trim();
        loadOrgs({ reset: true });
      }, 350);
    });
  }
  orgStatusFilter?.addEventListener('change', renderTable);
  orgBillingFilter?.addEventListener('change', renderTable);
  reloadOrgs?.addEventListener('click', () => loadOrgs({ reset: true }));
  loadMoreOrgs?.addEventListener('click', () => loadOrgs());
  orgToggleStatus?.addEventListener('click', toggleOrgStatus);
  orgSavePlan?.addEventListener('click', applyOrgPlan);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.close === 'org-modal') {
      closeModal();
      return;
    }
    if (target.dataset.action === 'manage') {
      openOrgModal(target.dataset.id);
      return;
    }
    if (target.dataset.action === 'toggle-user') {
      toggleUserStatus(target.dataset.id);
      return;
    }
  });
}

onReady(async () => {
  requireAuth();
  try {
    const me = await apiFetch('/api/auth/me');
    const user = me?.data?.user || me?.user;
    if (!user?.is_superadmin) {
      showToast('Superadmin access required', 'error');
      window.location.href = '/admin/dashboard.html';
      return;
    }
  } catch (err) {
    showError(err);
    return;
  }
  await loadPlanOptions();
  bindEvents();
  await loadOrgs({ reset: true });
});

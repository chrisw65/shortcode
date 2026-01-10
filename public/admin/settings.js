import { requireAuth, api, getActiveOrgId, setActiveOrgId, logoutAndRedirect } from '/admin/admin-common.js?v=20260112';

requireAuth();

const meEmail = document.getElementById('meEmail');
const meRole = document.getElementById('meRole');
const meOrg = document.getElementById('meOrg');
const meSuper = document.getElementById('meSuper');
const orgSelect = document.getElementById('orgSelect');
const orgName = document.getElementById('orgName');
const orgRole = document.getElementById('orgRole');
const orgIpAnon = document.getElementById('orgIpAnon');
const orgRetention = document.getElementById('orgRetention');
const orgSaveBtn = document.getElementById('orgSaveBtn');
const orgMsg = document.getElementById('orgMsg');
const btnChange = document.getElementById('btnChange');
const curPass = document.getElementById('curPass');
const newPass = document.getElementById('newPass');
const msg = document.getElementById('msg');
const privacyExportBtn = document.getElementById('privacyExportBtn');
const privacyDeleteBtn = document.getElementById('privacyDeleteBtn');
const privacyAcceptBtn = document.getElementById('privacyAcceptBtn');
const privacyMsg = document.getElementById('privacyMsg');


function setText(el, value) {
  if (el) el.textContent = value ?? '—';
}

async function loadMe() {
  try {
    const res = await api('/api/auth/me');
    const data = res?.data || res;
    setText(meEmail, data?.user?.email || '—');
    setText(meRole, data?.org?.role || 'member');
    setText(meOrg, data?.org?.orgId || '—');
    setText(meSuper, data?.user?.is_superadmin ? 'yes' : 'no');
  } catch (e) {
    setText(meEmail, '—');
  }
}

async function loadOrgSettings() {
  try {
    const res = await api('/api/orgs');
    const data = res?.data || [];
    if (orgSelect) {
      if (!data.length) {
        orgSelect.innerHTML = '<option value="">No orgs found</option>';
        orgSelect.disabled = true;
      } else {
        orgSelect.disabled = false;
        orgSelect.innerHTML = data.map((org) => (
          `<option value="${org.id}">${org.name || org.id}</option>`
        )).join('');
        const current = getActiveOrgId() || data[0]?.id || '';
        if (current) {
          setActiveOrgId(current);
          orgSelect.value = current;
        }
      }
    }
    const orgRes = await api('/api/org');
    const orgData = orgRes?.data || orgRes;
    if (orgName) orgName.value = orgData?.name || '';
    if (orgRole) orgRole.value = data.find((o) => o.id === (getActiveOrgId() || orgData?.id))?.role || '';
    if (orgIpAnon) orgIpAnon.checked = Boolean(orgData?.ip_anonymization);
    if (orgRetention) orgRetention.value = orgData?.data_retention_days ? String(orgData.data_retention_days) : '';
    if (meOrg && orgData?.name) meOrg.textContent = orgData.name;
  } catch (e) {
    if (orgMsg) orgMsg.textContent = e?.message || 'Failed to load orgs.';
  }
}

async function saveOrgSettings() {
  if (!orgName) return;
  const name = orgName.value.trim();
  if (!name) {
    if (orgMsg) orgMsg.textContent = 'Organization name is required.';
    return;
  }
  if (orgSaveBtn) orgSaveBtn.disabled = true;
  if (orgMsg) orgMsg.textContent = '';
  try {
    const retentionRaw = orgRetention ? orgRetention.value.trim() : '';
    const retentionValue = retentionRaw ? Number(retentionRaw) : null;
    if (retentionRaw && (!Number.isInteger(retentionValue) || retentionValue < 1 || retentionValue > 3650)) {
      if (orgMsg) orgMsg.textContent = 'Retention must be 1-3650 days.';
      if (orgSaveBtn) orgSaveBtn.disabled = false;
      return;
    }
    await api('/api/org', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        ip_anonymization: orgIpAnon ? orgIpAnon.checked : undefined,
        data_retention_days: retentionRaw ? retentionValue : null,
      }),
    });
    if (orgMsg) orgMsg.textContent = 'Organization updated.';
  } catch (e) {
    if (orgMsg) orgMsg.textContent = e?.message || 'Failed to update org.';
  } finally {
    if (orgSaveBtn) orgSaveBtn.disabled = false;
  }
}

function onOrgSwitch() {
  if (!orgSelect) return;
  const selected = orgSelect.value;
  setActiveOrgId(selected);
  window.location.reload();
}

async function changePassword() {
  const current_password = (curPass.value || '').trim();
  const new_password = (newPass.value || '').trim();
  msg.textContent = '';

  if (!current_password || !new_password) {
    msg.textContent = 'Both fields are required.';
    return;
  }
  if (new_password.length < 8) {
    msg.textContent = 'New password must be at least 8 characters.';
    return;
  }

  btnChange.disabled = true;
  try {
    await api('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password, new_password })
    });
    msg.textContent = 'Password updated.';
    curPass.value = '';
    newPass.value = '';
  } catch (e) {
    msg.textContent = e?.message || 'Failed to update password.';
  } finally {
    btnChange.disabled = false;
  }
}

btnChange?.addEventListener('click', changePassword);
orgSaveBtn?.addEventListener('click', saveOrgSettings);
orgSelect?.addEventListener('change', onOrgSwitch);
privacyExportBtn?.addEventListener('click', () => {
  window.location.href = '/api/privacy/export';
});
privacyAcceptBtn?.addEventListener('click', async () => {
  if (privacyMsg) privacyMsg.textContent = '';
  try {
    await api('/api/privacy/accept-terms', { method: 'POST' });
    if (privacyMsg) privacyMsg.textContent = 'Terms accepted.';
  } catch (e) {
    if (privacyMsg) privacyMsg.textContent = e?.message || 'Failed to accept terms.';
  }
});
privacyDeleteBtn?.addEventListener('click', async () => {
  if (!window.confirm('Delete your account? This cannot be undone.')) return;
  if (privacyMsg) privacyMsg.textContent = '';
  try {
    await api('/api/privacy/delete', { method: 'POST' });
    logoutAndRedirect();
  } catch (e) {
    if (privacyMsg) privacyMsg.textContent = e?.message || 'Failed to delete account.';
  }
});
loadMe();
loadOrgSettings();

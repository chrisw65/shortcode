import { requireAuth, api, getActiveOrgId, setActiveOrgId } from '/admin/admin-common.js?v=20260112';

requireAuth();

const meEmail = document.getElementById('meEmail');
const meRole = document.getElementById('meRole');
const meOrg = document.getElementById('meOrg');
const meSuper = document.getElementById('meSuper');
const orgSelect = document.getElementById('orgSelect');
const orgName = document.getElementById('orgName');
const orgRole = document.getElementById('orgRole');
const orgSaveBtn = document.getElementById('orgSaveBtn');
const orgMsg = document.getElementById('orgMsg');
const btnChange = document.getElementById('btnChange');
const curPass = document.getElementById('curPass');
const newPass = document.getElementById('newPass');
const msg = document.getElementById('msg');


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
    await api('/api/org', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
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
loadMe();
loadOrgSettings();

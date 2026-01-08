import { requireAuth, api, logout } from '/admin/admin-common.js';

requireAuth();

const meEmail = document.getElementById('meEmail');
const meRole = document.getElementById('meRole');
const meOrg = document.getElementById('meOrg');
const meSuper = document.getElementById('meSuper');
const btnChange = document.getElementById('btnChange');
const curPass = document.getElementById('curPass');
const newPass = document.getElementById('newPass');
const msg = document.getElementById('msg');

document.getElementById('logoutBtn')?.addEventListener('click', () => logout());

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
loadMe();

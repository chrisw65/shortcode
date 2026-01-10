// v8 — login page logic
import { setToken, getToken } from '/admin/admin-common.js?v=20260120';

const form = document.getElementById('login-form');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const btn = document.getElementById('btn-login');
const ssoOrgId = document.getElementById('ssoOrgId');
const btnSso = document.getElementById('btn-sso');

// If already logged in, bounce to dashboard
if (getToken()) {
  location.replace('/admin/dashboard.html');
}

const url = new URL(window.location.href);
const tokenParam = url.searchParams.get('token') || new URLSearchParams(url.hash.replace(/^#/, '')).get('token');
if (tokenParam) {
  setToken(tokenParam);
  url.hash = '';
  url.searchParams.delete('token');
  window.history.replaceState({}, '', url.toString());
  location.replace('/admin/dashboard.html');
}

function uiBusy(busy) {
  if (!btn) return;
  btn.disabled = !!busy;
  btn.textContent = busy ? 'Logging in…' : 'Login';
}

async function login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email, password })
  });

  let json = null;
  try { json = await res.json(); } catch { json = null; }

  if (!res.ok) {
    const msg = json?.error || `Login failed (HTTP ${res.status})`;
    throw new Error(msg);
  }

  const token = json?.data?.token || json?.token;
  if (!token) throw new Error('No token returned by server');
  return token;
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = (emailEl?.value || '').trim();
  const password = (passwordEl?.value || '').trim();

  if (!email || !password) {
    alert('Please enter email and password.');
    return;
  }

  uiBusy(true);
  try {
    const token = await login(email, password);
    setToken(token);
    location.replace('/admin/dashboard.html'); // success
  } catch (err) {
    console.error('login error:', err);
    alert(err?.message || 'Login failed. Check your credentials.');
  } finally {
    uiBusy(false);
  }
});

btnSso?.addEventListener('click', () => {
  const orgId = (ssoOrgId?.value || '').trim();
  if (!orgId) {
    alert('Organization ID is required for SSO.');
    return;
  }
  const redirect = encodeURIComponent('/admin/dashboard.html');
  window.location.href = `/api/auth/oidc/start?org_id=${encodeURIComponent(orgId)}&redirect=${redirect}`;
});

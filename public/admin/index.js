// v8 — login page logic
import { setToken, getToken } from '/admin/admin-common.js?v=20260120';

const form = document.getElementById('login-form');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const btn = document.getElementById('btn-login');
const ssoOrgId = document.getElementById('ssoOrgId');
const btnSso = document.getElementById('btn-sso');
const twofaBlock = document.getElementById('twofaBlock');
const twofaCodeEl = document.getElementById('twofaCode');
let twofaChallengeToken = '';
let twofaRequired = false;

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
  if (busy) {
    btn.textContent = twofaRequired ? 'Verifying…' : 'Logging in…';
  } else {
    btn.textContent = twofaRequired ? 'Verify code' : 'Login';
  }
}

function setTwofaMode(enabled) {
  twofaRequired = enabled;
  if (twofaBlock) twofaBlock.style.display = enabled ? 'block' : 'none';
  if (emailEl) emailEl.disabled = enabled;
  if (passwordEl) passwordEl.disabled = enabled;
  if (btn) btn.textContent = enabled ? 'Verify code' : 'Login';
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

  const data = json?.data || {};
  if (data?.requires_2fa && data?.challenge_token) {
    return { requires2fa: true, challengeToken: data.challenge_token };
  }
  const token = data?.token || json?.token;
  if (!token) throw new Error('No token returned by server');
  return { token };
}

async function confirmTwoFactor(challengeToken, code) {
  const res = await fetch('/api/auth/2fa/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ challenge_token: challengeToken, code })
  });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (!res.ok) {
    const msg = json?.error || `2FA failed (HTTP ${res.status})`;
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
  const code = (twofaCodeEl?.value || '').trim();

  if (!twofaRequired && (!email || !password)) {
    alert('Please enter email and password.');
    return;
  }
  if (twofaRequired && (!code || !twofaChallengeToken)) {
    alert('Enter your 2FA code.');
    return;
  }

  uiBusy(true);
  try {
    if (twofaRequired) {
      const token = await confirmTwoFactor(twofaChallengeToken, code);
      setToken(token);
      location.replace('/admin/dashboard.html'); // success
      return;
    }
    const result = await login(email, password);
    if (result.requires2fa) {
      twofaChallengeToken = result.challengeToken;
      setTwofaMode(true);
      if (twofaCodeEl) twofaCodeEl.focus();
      return;
    }
    setToken(result.token);
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

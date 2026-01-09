// v8 — login page logic
import { setToken, getToken } from '/admin/admin-common.js?v=20260112';

const form = document.getElementById('login-form');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const btn = document.getElementById('btn-login');

// If already logged in, bounce to dashboard
if (getToken()) {
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


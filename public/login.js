const loginBtn = document.getElementById('loginBtn');
const notice = document.getElementById('loginNotice');
const loginSsoBtn = document.getElementById('loginSsoBtn');
const ssoOrgIdInput = document.getElementById('ssoOrgId');

function setNotice(msg, isError = false) {
  if (!notice) return;
  notice.textContent = msg;
  notice.style.color = isError ? '#ff6b6b' : '#9fb0c3';
}

async function login() {
  const email = document.getElementById('email')?.value || '';
  const password = document.getElementById('password')?.value || '';
  if (!email || !password) {
    setNotice('Email and password are required.', true);
    return;
  }

  loginBtn.disabled = true;
  setNotice('Signing in…');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Login failed');

    if (data?.data?.token) {
      localStorage.setItem('admin_token', data.data.token);
    }

    window.location.href = '/admin/dashboard.html';
  } catch (err) {
    setNotice(err.message || 'Login failed', true);
  } finally {
    loginBtn.disabled = false;
  }
}

if (loginBtn) {
  loginBtn.addEventListener('click', () => {
    login();
  });
}

if (loginSsoBtn) {
  loginSsoBtn.addEventListener('click', () => {
    const orgId = (ssoOrgIdInput?.value || '').trim();
    if (!orgId) {
      setNotice('Organization ID is required for SSO login.', true);
      return;
    }
    const redirect = encodeURIComponent('/admin/dashboard.html');
    window.location.href = `/api/auth/oidc/start?org_id=${encodeURIComponent(orgId)}&redirect=${redirect}`;
  });
}

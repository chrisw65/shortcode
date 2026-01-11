const loginBtn = document.getElementById('loginBtn');
const notice = document.getElementById('loginNotice');
const loginSsoBtn = document.getElementById('loginSsoBtn');
const ssoOrgIdInput = document.getElementById('ssoOrgId');
const resendVerifyBtn = document.getElementById('resendVerifyBtn');

function csrfHeaders() {
  const token = document.cookie.split(';').map((p) => p.trim()).find((p) => p.startsWith('csrf_token='));
  if (!token) return {};
  return { 'X-CSRF-Token': decodeURIComponent(token.split('=').slice(1).join('=')) };
}

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
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (data?.requires_email_verification) {
        setNotice('Email not verified. Use resend verification to get a new link.', true);
        return;
      }
      throw new Error(data?.error || 'Login failed');
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

async function resendVerification() {
  const email = document.getElementById('email')?.value || '';
  if (!email) {
    setNotice('Enter your email to resend verification.', true);
    return;
  }
  resendVerifyBtn.disabled = true;
  setNotice('Sending verification email…');
  try {
    const res = await fetch('/api/auth/verify-email/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Request failed');
    setNotice('Verification email sent if the address exists.');
  } catch (err) {
    setNotice(err.message || 'Request failed', true);
  } finally {
    resendVerifyBtn.disabled = false;
  }
}

if (resendVerifyBtn) {
  resendVerifyBtn.addEventListener('click', () => {
    resendVerification();
  });
}

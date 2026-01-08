const loginBtn = document.getElementById('loginBtn');
const notice = document.getElementById('loginNotice');

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

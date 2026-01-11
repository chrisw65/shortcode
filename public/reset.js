const resetBtn = document.getElementById('resetBtn');
const notice = document.getElementById('resetNotice');

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

function getToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') || '';
}

async function resetPassword() {
  const token = getToken();
  const password = document.getElementById('password')?.value || '';
  const confirm = document.getElementById('passwordConfirm')?.value || '';
  if (!token) {
    setNotice('Reset token is missing.', true);
    return;
  }
  if (!password || !confirm) {
    setNotice('Password fields are required.', true);
    return;
  }
  if (password !== confirm) {
    setNotice('Passwords do not match.', true);
    return;
  }
  resetBtn.disabled = true;
  setNotice('Updating password…');

  try {
    const res = await fetch('/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Reset failed');
    setNotice('Password updated. Redirecting to login…');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 1200);
  } catch (err) {
    setNotice(err.message || 'Reset failed', true);
  } finally {
    resetBtn.disabled = false;
  }
}

if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    resetPassword();
  });
}

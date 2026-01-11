const notice = document.getElementById('verifyNotice');

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

async function verifyEmail() {
  const token = getToken();
  if (!token) {
    setNotice('Verification token is missing.', true);
    return;
  }
  try {
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Verification failed');
    setNotice('Email verified. You can now log in.');
  } catch (err) {
    setNotice(err.message || 'Verification failed', true);
  }
}

verifyEmail();

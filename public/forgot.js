const resetBtn = document.getElementById('resetRequestBtn');
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

async function requestReset() {
  const email = document.getElementById('email')?.value || '';
  if (!email) {
    setNotice('Email is required.', true);
    return;
  }
  resetBtn.disabled = true;
  setNotice('Sending reset link…');

  try {
    const res = await fetch('/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Request failed');
    setNotice('If the email exists, a reset link has been sent.');
  } catch (err) {
    setNotice(err.message || 'Request failed', true);
  } finally {
    resetBtn.disabled = false;
  }
}

if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    requestReset();
  });
}

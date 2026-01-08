const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const notice = document.querySelector('.notice');
const loginBtn = document.querySelector('button.btn.primary');

function setNotice(message, isError = false) {
  if (!notice) return;
  notice.textContent = message;
  notice.style.color = isError ? '#ff7b7b' : '';
}

async function loginAffiliate() {
  const email = (emailInput?.value || '').trim();
  const password = passwordInput?.value || '';
  if (!email || !password) {
    setNotice('Email and password are required.', true);
    return;
  }

  loginBtn.disabled = true;
  setNotice('Signing in...');
  try {
    const res = await fetch('/api/affiliate/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Login failed');

    localStorage.setItem('affiliate_token', data.data.token);
    window.location.href = '/affiliate/dashboard.html';
  } catch (err) {
    setNotice(err.message || 'Login failed', true);
  } finally {
    loginBtn.disabled = false;
  }
}

loginBtn?.addEventListener('click', loginAffiliate);

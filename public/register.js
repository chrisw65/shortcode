const registerBtn = document.getElementById('registerBtn');
const notice = document.getElementById('registerNotice');

function setNotice(msg, isError = false) {
  if (!notice) return;
  notice.textContent = msg;
  notice.style.color = isError ? '#ff6b6b' : '#9fb0c3';
}

async function register() {
  const name = document.getElementById('name')?.value || '';
  const email = document.getElementById('email')?.value || '';
  const password = document.getElementById('password')?.value || '';
  const termsAccepted = document.getElementById('termsAccepted')?.checked || false;
  const termsVersion = document.body?.dataset?.termsVersion || '2026-01';
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get('invite') || '';
  const affiliateCode = params.get('aff') || '';
  const couponCode = params.get('coupon') || '';
  if (!email || !password) {
    setNotice('Email and password are required.', true);
    return;
  }
  if (!termsAccepted) {
    setNotice('You must accept the terms to continue.', true);
    return;
  }

  registerBtn.disabled = true;
  setNotice('Creating account…');

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        invite_token: inviteToken,
        affiliate_code: affiliateCode,
        coupon_code: couponCode,
        terms_accepted: termsAccepted,
        terms_version: termsVersion,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Registration failed');

    if (data?.data?.token) {
      localStorage.setItem('admin_token', data.data.token);
    }

    window.location.href = '/admin/dashboard.html';
  } catch (err) {
    setNotice(err.message || 'Registration failed', true);
  } finally {
    registerBtn.disabled = false;
  }
}

if (registerBtn) {
  registerBtn.addEventListener('click', () => {
    register();
  });
}

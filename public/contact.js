function csrfHeaders() {
  const token = document.cookie.split(';').map((p) => p.trim()).find((p) => p.startsWith('csrf_token='));
  if (!token) return {};
  return { 'X-CSRF-Token': decodeURIComponent(token.split('=').slice(1).join('=')) };
}

async function sendContact() {
  const name = document.getElementById('name')?.value.trim();
  const company = document.getElementById('company')?.value.trim();
  const org = document.getElementById('org')?.value.trim();
  const email = document.getElementById('email')?.value.trim();
  const message = document.getElementById('message')?.value.trim();
  const website = document.getElementById('website')?.value.trim();
  const captchaAnswer = document.getElementById('captchaAnswer')?.value.trim();
  const captchaProvider = document.getElementById('contactCaptchaWrap')?.dataset?.provider || 'simple';
  const captchaToken = document.querySelector('input[name="cf-turnstile-response"]')?.value || '';
  const notice = document.getElementById('contactNotice');
  const toast = typeof window?.showSiteToast === 'function' ? window.showSiteToast : null;
  const notify = (message, kind = 'ok') => {
    if (notice) notice.textContent = message;
    if (toast) toast(message, kind);
  };

  if (!name || !email || !message) {
    notify('Name, email, and message are required.', 'error');
    return;
  }
  if (captchaProvider === 'simple' && !captchaAnswer) {
    notify('Captcha answer is required.', 'error');
    return;
  }
  if (captchaProvider === 'turnstile' && !captchaToken) {
    notify('Captcha verification is required.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/public/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ name, company, org, email, message, website, captchaAnswer, captchaToken }),
    });
    const data = await res.json().catch((err) => { console.warn('Failed to parse JSON response', err); return null; });
    if (!res.ok) throw new Error(data?.error || 'Failed to send');
    notify(data?.message || 'Thanks! We will get back to you within 1 business day.');
  } catch (err) {
    notify(err?.message || 'Failed to send your message.', 'error');
  }
}

document.getElementById('contactSendBtn')?.addEventListener('click', sendContact);

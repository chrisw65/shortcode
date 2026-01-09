async function sendContact() {
  const name = document.getElementById('name')?.value.trim();
  const company = document.getElementById('company')?.value.trim();
  const org = document.getElementById('org')?.value.trim();
  const email = document.getElementById('email')?.value.trim();
  const message = document.getElementById('message')?.value.trim();
  const website = document.getElementById('website')?.value.trim();
  const captchaAnswer = document.getElementById('captchaAnswer')?.value.trim();
  const notice = document.getElementById('contactNotice');

  if (!name || !email || !message) {
    if (notice) notice.textContent = 'Name, email, and message are required.';
    return;
  }

  try {
    const res = await fetch('/api/public/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, company, org, email, message, website, captchaAnswer }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Failed to send');
    if (notice) notice.textContent = data?.message || 'Thanks! We will get back to you within 1 business day.';
  } catch (err) {
    if (notice) notice.textContent = err?.message || 'Failed to send your message.';
  }
}

document.getElementById('contactSendBtn')?.addEventListener('click', sendContact);

async function applyAffiliateTheme() {
  try {
    const res = await fetch('/api/public/site-config', { credentials: 'same-origin' });
    const data = await res.json().catch(() => null);
    const theme = data?.data?.ui?.affiliateTheme || 'noir';
    document.body.classList.add(`theme-${theme}`);
  } catch (err) {
    console.warn('affiliate theme load failed', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyAffiliateTheme);
} else {
  applyAffiliateTheme();
}

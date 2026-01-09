async function applyAffiliateTheme() {
  try {
    const res = await fetch('/api/public/site-config', { credentials: 'same-origin' });
    const data = await res.json().catch(() => null);
    const theme = data?.data?.ui?.affiliateTheme || 'noir';
    const tokens = data?.data?.ui?.affiliateThemeTokens || {};
    document.body.classList.add(`theme-${theme}`);
    const root = document.documentElement;
    if (tokens.bg) root.style.setProperty('--bg', tokens.bg);
    if (tokens.bg) root.style.setProperty('--bg-2', tokens.bg);
    if (tokens.surface) root.style.setProperty('--surface', tokens.surface);
    if (tokens.text) root.style.setProperty('--text', tokens.text);
    if (tokens.muted) root.style.setProperty('--muted', tokens.muted);
    if (tokens.accent) root.style.setProperty('--accent', tokens.accent);
    if (tokens.accent2) root.style.setProperty('--accent-2', tokens.accent2);
    if (tokens.line) root.style.setProperty('--line', tokens.line);
  } catch (err) {
    console.warn('affiliate theme load failed', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyAffiliateTheme);
} else {
  applyAffiliateTheme();
}

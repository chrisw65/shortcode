// Admin helper module (ESM) with FULL back-compat exports
// Drop this into /public/admin/admin-common.js

// ========================= Auth =========================
const AUTH_PRESENT_COOKIE = 'auth_present';
const ORG_KEY = 'active_org_id';
const API_BASE = ''; // same-origin

try { localStorage.removeItem('admin_token'); } catch {}

function getCookie(name) {
  const parts = document.cookie.split(';').map((p) => p.trim());
  for (const part of parts) {
    if (!part) continue;
    const [k, ...rest] = part.split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function getCsrfToken() {
  return getCookie('csrf_token') || '';
}

export const getToken = () => '';
export const clearToken = () => {};
export async function setToken(t) {
  if (!t) return;
  await apiFetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: t }),
  });
}
export const hasSession = () => Boolean(getCookie(AUTH_PRESENT_COOKIE));
export const getActiveOrgId = () => localStorage.getItem(ORG_KEY) || '';
export const setActiveOrgId = (orgId) => {
  if (orgId) localStorage.setItem(ORG_KEY, orgId);
  else localStorage.removeItem(ORG_KEY);
};

function captureTokenFromUrl() {
  const url = new URL(window.location.href);
  let token = url.searchParams.get('token');
  let hashParams = null;
  if (!token && url.hash) {
    hashParams = new URLSearchParams(url.hash.slice(1));
    token = hashParams.get('token');
  }
  if (token) {
    void setToken(token);
    url.searchParams.delete('token');
    if (hashParams) {
      hashParams.delete('token');
      url.hash = hashParams.toString() ? `#${hashParams}` : '';
    }
    window.history.replaceState({}, '', url.toString());
  }
}

captureTokenFromUrl();

export function requireAuth() {
  if (!hasSession()) {
    // redirect to login, then throw to stop page logic
    window.location.href = '/admin/index.html';
    throw new Error('Not authenticated');
  }
  apiFetch('/api/auth/me').catch(() => {
    console.warn('Auth session check failed.');
    window.location.href = '/admin/index.html';
  });
}

export function logoutAndRedirect() {
  apiFetch('/api/auth/logout', { method: 'POST' }).catch((err) => {
    console.warn('Logout failed.', err);
  });
  document.cookie = `${AUTH_PRESENT_COOKIE}=; Max-Age=0; Path=/`;
  window.location.href = '/admin/index.html';
}

// Auto-wire logout button if present
onReady(() => {
  const btn = document.getElementById('logoutBtn');
  if (btn) btn.addEventListener('click', logoutAndRedirect);
});

// ========================= API =========================
export async function apiFetch(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const csrf = getCsrfToken();
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const tok = getToken();
  if (tok) headers.Authorization = `Bearer ${tok}`;
  const orgId = getActiveOrgId();
  if (orgId) headers['X-Org-Id'] = orgId;

  const { _retry, ...fetchOpts } = opts;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    ...fetchOpts,
    headers,
  });
  if (res.status === 401 && !_retry && hasSession()) {
    try {
      await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });
      return apiFetch(path, { ...opts, _retry: true });
    } catch (err) {
      console.warn('Auth refresh failed.', err);
    }
  }

  // Attempt to parse JSON; if not JSON, still let 2xx return an empty object
  let body = null;
  const text = await res.text();
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }

  if (!res.ok) {
    const message = body?.error || body?.message || `${res.status} ${res.statusText}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body ?? { success: true };
}

// Convenience wrappers
export const apiGet  = (p)            => apiFetch(p);
export const apiPost = (p, data={})   => apiFetch(p, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
export const apiDel  = (p)            => apiFetch(p, { method:'DELETE' });

// ========================= UI / DOM helpers =========================
export const $  = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

export function onReady(fn) {
  if (document.readyState === 'complete' || document.readyState === 'interactive') { fn(); }
  else document.addEventListener('DOMContentLoaded', fn, { once:true });
}

function applyAdminBrand(config) {
  const brand = config?.brand || {};
  const name = brand.name || 'OkLeaf';
  const logoUrl = brand.logoUrl || '';
  const logoAlt = brand.logoAlt || name;
  const initial = name.trim().charAt(0).toUpperCase() || 'O';

  document.querySelectorAll('.brand').forEach((el) => {
    const badge = el.querySelector('.brand-badge');
    const label = el.querySelector('span:last-child');
    if (label) label.textContent = name;
    if (badge) {
      if (logoUrl) {
        while (badge.firstChild) badge.removeChild(badge.firstChild);
        const img = document.createElement('img');
        img.className = 'brand-logo';
        img.src = logoUrl;
        img.alt = logoAlt;
        badge.appendChild(img);
      } else {
        badge.textContent = initial;
      }
    }
  });
}

async function applyAdminTheme() {
  try {
    const res = await fetch('/api/public/site-config', { credentials: 'same-origin' });
    const data = await res.json().catch((err) => { console.warn('Failed to parse JSON response', err); return null; });
    const config = data?.data || {};
    const theme = config?.ui?.adminTheme || 'noir';
    const tokens = config?.ui?.adminThemeTokens || {};
    document.body.classList.add(`theme-${theme}`);
    const root = document.documentElement;
    if (tokens.bg) root.style.setProperty('--bg', tokens.bg);
    if (tokens.bg) root.style.setProperty('--bg-2', tokens.bg);
    if (tokens.panel) root.style.setProperty('--panel', tokens.panel);
    if (tokens.text) root.style.setProperty('--text', tokens.text);
    if (tokens.muted) root.style.setProperty('--muted', tokens.muted);
    if (tokens.accent) root.style.setProperty('--accent', tokens.accent);
    if (tokens.accent2) root.style.setProperty('--accent-2', tokens.accent2);
    if (tokens.border) root.style.setProperty('--border', tokens.border);
    applyAdminBrand(config);
  } catch (err) {
    console.warn('admin theme load failed', err);
  }
}

function ensureAdminNavIncludesEcosystem() {
  const nav = document.querySelector('.side-nav');
  if (!nav) return;
  if (nav.querySelector('a[href="/admin/ecosystem.html"]')) return;
  const link = document.createElement('a');
  link.href = '/admin/ecosystem.html';
  link.textContent = 'Ecosystem';
  const billingLink = nav.querySelector('a[href="/admin/billing.html"]');
  if (billingLink && billingLink.parentNode) {
    billingLink.insertAdjacentElement('afterend', link);
  } else {
    nav.appendChild(link);
  }
}

function ensureAdminNavIncludesBio() {
  const nav = document.querySelector('.side-nav');
  if (!nav) return;
  if (nav.querySelector('a[href="/admin/bio.html"]')) return;
  const link = document.createElement('a');
  link.href = '/admin/bio.html';
  link.textContent = 'Link-in-bio';
  const linksLink = nav.querySelector('a[href="/admin/links.html"]');
  if (linksLink && linksLink.parentNode) {
    linksLink.insertAdjacentElement('afterend', link);
  } else {
    nav.appendChild(link);
  }
}

function ensureAdminNavIncludesMobileApps() {
  const nav = document.querySelector('.side-nav');
  if (!nav) return;
  if (nav.querySelector('a[href="/admin/mobile-apps.html"]')) return;
  const link = document.createElement('a');
  link.href = '/admin/mobile-apps.html';
  link.textContent = 'Mobile apps';
  const bioLink = nav.querySelector('a[href="/admin/bio.html"]');
  if (bioLink && bioLink.parentNode) {
    bioLink.insertAdjacentElement('afterend', link);
  } else {
    nav.appendChild(link);
  }
}

async function ensureEmailVerificationBanner() {
  if (!hasSession()) return;
  const main = document.querySelector('.admin-main');
  if (!main || main.querySelector('[data-email-banner]')) return;
  try {
    const me = await apiFetch('/api/auth/me');
    const user = me?.data?.user || me?.user;
    if (!user || user.email_verified !== false) return;
    const email = escapeHtml(user.email || '');
    const banner = document.createElement('div');
    banner.className = 'admin-banner';
    banner.dataset.emailBanner = '1';
    banner.innerHTML = `
      <div>
        <div style="font-weight:600">Email not verified</div>
        <div class="muted">Verify ${email} to keep your account active.</div>
      </div>
      <div class="row" style="gap:10px">
        <button class="btn ghost" type="button" data-action="resend-verify">Resend verification</button>
        <a class="btn" href="/verify.html">Open verification</a>
      </div>
    `;
    main.insertBefore(banner, main.firstChild);
    const resendBtn = banner.querySelector('[data-action="resend-verify"]');
    resendBtn?.addEventListener('click', async () => {
      resendBtn.disabled = true;
      resendBtn.textContent = 'Sending…';
      try {
        await apiFetch('/api/auth/verify-email/resend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
        });
        resendBtn.textContent = 'Sent';
      } catch {
        resendBtn.textContent = 'Retry';
      } finally {
        setTimeout(() => { resendBtn.disabled = false; }, 1200);
      }
    });
  } catch {
    // ignore banner failures
  }
}

async function ensureExtensionInstallBanner() {
  if (!hasSession()) return;
  const main = document.querySelector('.admin-main');
  if (!main || main.querySelector('[data-extension-banner]')) return;
  try {
    if (localStorage.getItem('extension_banner_dismissed') === '1') return;
    const banner = document.createElement('div');
    banner.className = 'admin-banner info';
    banner.dataset.extensionBanner = '1';
    banner.innerHTML = `
      <div>
        <div style="font-weight:600">Install the OkLeaf extension</div>
        <div class="muted">Shorten any page from your toolbar without leaving your workflow.</div>
      </div>
      <div class="row" style="gap:10px">
        <a class="btn ghost" href="/docs/extensions.html">Install guide</a>
        <a class="btn" href="/extension/okleaf-extension.zip">Download zip</a>
        <button class="btn ghost" type="button" data-action="dismiss-extension">Dismiss</button>
      </div>
    `;
    main.insertBefore(banner, main.firstChild);
    const dismissBtn = banner.querySelector('[data-action="dismiss-extension"]');
    dismissBtn?.addEventListener('click', () => {
      localStorage.setItem('extension_banner_dismissed', '1');
      banner.remove();
    });
  } catch {
    // ignore banner failures
  }
}

async function ensureOrgSwitcher() {
  if (!hasSession()) return;
  const top = document.querySelector('.admin-top');
  if (!top || top.querySelector('[data-org-switcher]')) return;
  try {
    const res = await apiFetch('/api/orgs');
    const orgs = res?.data || res || [];
    if (!Array.isArray(orgs) || !orgs.length) return;
    const current = getActiveOrgId() || orgs[0].id;
    setActiveOrgId(current);
    const wrap = document.createElement('div');
    wrap.dataset.orgSwitcher = '1';
    wrap.className = 'row';
    wrap.style.gap = '10px';
    wrap.innerHTML = `
      <label class="muted" style="font-size:12px">Org</label>
      <select class="input" style="min-width:180px"></select>
    `;
    const select = wrap.querySelector('select');
    select.innerHTML = orgs.map((org) => (
      `<option value="${escapeHtml(org.id)}">${escapeHtml(org.name || org.id)}</option>`
    )).join('');
    select.value = current;
    select.addEventListener('change', () => {
      setActiveOrgId(select.value);
      window.location.reload();
    });
    top.appendChild(wrap);
  } catch (err) {
    console.warn('org switcher load failed', err);
  }
}

onReady(() => {
  applyAdminTheme();
  ensureAdminNavIncludesEcosystem();
  ensureAdminNavIncludesBio();
  ensureAdminNavIncludesMobileApps();
  ensureEmailVerificationBanner();
  ensureExtensionInstallBanner();
  ensureOrgSwitcher();
});

export function setText(el, value) {
  const node = typeof el === 'string' ? $(el) : el;
  if (node) node.textContent = value ?? '';
}
export function setHTML(el, html) {
  const node = typeof el === 'string' ? $(el) : el;
  if (node) node.innerHTML = html ?? '';
}

export function showToast(message, kind='ok') {
  const d = document.createElement('div');
  d.textContent = message;
  d.className = `toast ${kind === 'error' ? 'toast-error' : 'toast-ok'}`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2400);
}

export function showError(e, fallback='Something went wrong') {
  const msg = (e && (e.message || e.error)) || fallback;
  console.error('admin-common error:', e);
  showToast(msg, 'error');
}

// ========================= Utilities =========================
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function debounce(fn, wait=300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
}

export function escapeHtml(s) {
  return (s ?? '').toString().replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly','');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('Copied to clipboard');
  }
}

export function buildUrl(base, params={}) {
  const u = new URL(base, window.location.origin);
  Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v); });
  return u.toString();
}

// ========================= No-op nav hooks (back-compat) =========================
// Some pages try to call these. We provide harmless placeholders.
export function menuNav() {}
export function mountNav() {}

// ========================= Back-compat aliases (VERY IMPORTANT) =========================
// These keep older pages functioning without edits.

// apiFetch -> api
export const api = apiFetch;

// logout
export const logout = logoutAndRedirect;

// copyToClipboard -> copyText
export function copyText(t) { return copyToClipboard(t); }

// formatDateTime -> fmtDate
export function fmtDate(iso) { return formatDateTime(iso); }

// escapeHtml -> htmlesc
export function htmlesc(s) { return escapeHtml(s); }

// Common names some pages may use:
export { onReady as domReady };
export { setText as text, setHTML as html };

// Version for sanity checks
export const __ADMIN_COMMON_VERSION__ = '1.1-bc-superset';

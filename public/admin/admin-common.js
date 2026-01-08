// Admin helper module (ESM) with FULL back-compat exports
// Drop this into /public/admin/admin-common.js

// ========================= Auth =========================
const TOKEN_KEY = 'admin_token';
const API_BASE = ''; // same-origin

export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t || '');
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export function requireAuth() {
  if (!getToken()) {
    // redirect to login, then throw to stop page logic
    window.location.href = '/admin/index.html';
    throw new Error('Not authenticated');
  }
}

export function logoutAndRedirect() {
  clearToken();
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
  const tok = getToken();
  if (tok) headers.Authorization = `Bearer ${tok}`;

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    ...opts,
    headers,
  });

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
  d.className = [
    'fixed','bottom-4','right-4','z-50','px-3','py-2','rounded','text-sm','shadow',
    kind === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
  ].join(' ');
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

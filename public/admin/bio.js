import { apiFetch, showToast, showError, htmlesc } from './admin-common.js';

const els = {
  bioPages: document.getElementById('bioPages'),
  bioListMsg: document.getElementById('bioListMsg'),
  bioEditorTitle: document.getElementById('bioEditorTitle'),
  bioEditorSubtitle: document.getElementById('bioEditorSubtitle'),
  bioSlug: document.getElementById('bioSlug'),
  bioTitle: document.getElementById('bioTitle'),
  bioDescription: document.getElementById('bioDescription'),
  bioAvatar: document.getElementById('bioAvatar'),
  bioCtaLabel: document.getElementById('bioCtaLabel'),
  bioCtaUrl: document.getElementById('bioCtaUrl'),
  bioThemeBg: document.getElementById('bioThemeBg'),
  bioThemeCard: document.getElementById('bioThemeCard'),
  bioThemeAccent: document.getElementById('bioThemeAccent'),
  bioThemeText: document.getElementById('bioThemeText'),
  bioThemeMuted: document.getElementById('bioThemeMuted'),
  bioActive: document.getElementById('bioActive'),
  bioLinks: document.getElementById('bioLinks'),
  bioLinksMsg: document.getElementById('bioLinksMsg'),
  bioSaveMsg: document.getElementById('bioSaveMsg'),
  bioRefresh: document.getElementById('bioRefresh'),
  bioNew: document.getElementById('bioNew'),
  bioSave: document.getElementById('bioSave'),
  bioDelete: document.getElementById('bioDelete'),
  bioAddLink: document.getElementById('bioAddLink'),
  bioReorder: document.getElementById('bioReorder'),
};

let pages = [];
let currentPage = null;

function readTheme() {
  return {
    bg: els.bioThemeBg?.value || '#0b0d10',
    card: els.bioThemeCard?.value || '#151c26',
    accent: els.bioThemeAccent?.value || '#e0b15a',
    text: els.bioThemeText?.value || '#f5f1e8',
    muted: els.bioThemeMuted?.value || '#b8b3a9',
  };
}

function setTheme(theme = {}) {
  if (els.bioThemeBg) els.bioThemeBg.value = theme.bg || '#0b0d10';
  if (els.bioThemeCard) els.bioThemeCard.value = theme.card || '#151c26';
  if (els.bioThemeAccent) els.bioThemeAccent.value = theme.accent || '#e0b15a';
  if (els.bioThemeText) els.bioThemeText.value = theme.text || '#f5f1e8';
  if (els.bioThemeMuted) els.bioThemeMuted.value = theme.muted || '#b8b3a9';
}

function clearEditor() {
  currentPage = null;
  if (els.bioEditorTitle) els.bioEditorTitle.textContent = 'Create page';
  if (els.bioEditorSubtitle) els.bioEditorSubtitle.textContent = 'Start a new profile page.';
  if (els.bioSlug) els.bioSlug.value = '';
  if (els.bioTitle) els.bioTitle.value = '';
  if (els.bioDescription) els.bioDescription.value = '';
  if (els.bioAvatar) els.bioAvatar.value = '';
  if (els.bioCtaLabel) els.bioCtaLabel.value = '';
  if (els.bioCtaUrl) els.bioCtaUrl.value = '';
  if (els.bioActive) els.bioActive.checked = true;
  setTheme({});
  renderLinks([]);
}

function renderPages() {
  if (!els.bioPages) return;
  if (!pages.length) {
    els.bioPages.innerHTML = '<div class="muted">No pages yet.</div>';
    return;
  }
  els.bioPages.innerHTML = pages.map((page) => `
    <div class="card">
      <div style="font-weight:600">${htmlesc(page.title || page.slug)}</div>
      <div class="muted small">/${htmlesc(page.slug)}</div>
      <div class="row-between" style="margin-top:10px">
        <div class="muted small">${page.is_active ? 'Active' : 'Inactive'} · ${page.link_count || 0} links</div>
        <div class="row" style="gap:8px">
          <a class="btn ghost" target="_blank" href="/b/${htmlesc(page.slug)}">View</a>
          <button class="btn" data-action="edit" data-id="${htmlesc(page.id)}">Edit</button>
        </div>
      </div>
    </div>
  `).join('');

  els.bioPages.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => loadPage(btn.dataset.id));
  });
}

function renderLinks(links = []) {
  if (!els.bioLinks) return;
  if (!links.length) {
    els.bioLinks.innerHTML = '<div class="muted">No links yet.</div>';
    return;
  }
  els.bioLinks.innerHTML = '';
  links.forEach((link) => {
    const row = document.createElement('div');
    row.className = 'card';
    row.dataset.id = link.id || '';
    row.innerHTML = `
      <div class="bio-link-row">
        <input class="input link-label" placeholder="Label" value="${htmlesc(link.label || '')}">
        <input class="input link-url" placeholder="https://example.com" value="${htmlesc(link.url || '')}">
        <input class="input link-icon" placeholder="Icon" value="${htmlesc(link.icon || '')}">
      </div>
      <div class="row-between" style="margin-top:8px">
        <div class="row" style="gap:10px">
          <label class="row" style="gap:6px">
            <span class="muted small">Order</span>
            <input class="input link-order" type="number" value="${htmlesc(String(link.sort_order || 100))}" style="max-width:120px">
          </label>
          <label class="row" style="gap:6px">
            <input class="link-active" type="checkbox" ${link.is_active !== false ? 'checked' : ''}>
            <span class="muted small">Active</span>
          </label>
        </div>
        <button class="btn danger link-delete" type="button">Remove</button>
      </div>
    `;
    row.querySelector('.link-delete').addEventListener('click', () => deleteLink(row.dataset.id));
    els.bioLinks.appendChild(row);
  });
}

async function loadPages() {
  if (els.bioListMsg) els.bioListMsg.textContent = '';
  try {
    const res = await apiFetch('/api/bio');
    pages = res?.data || [];
    renderPages();
  } catch (err) {
    if (els.bioListMsg) els.bioListMsg.textContent = 'Failed to load pages.';
    showError(err, 'Failed to load pages');
  }
}

async function loadPage(id) {
  if (!id) return;
  try {
    const res = await apiFetch(`/api/bio/${encodeURIComponent(id)}`);
    const page = res?.data;
    if (!page) return;
    currentPage = page;
    if (els.bioEditorTitle) els.bioEditorTitle.textContent = `Edit ${page.title || page.slug}`;
    if (els.bioEditorSubtitle) els.bioEditorSubtitle.textContent = `/${page.slug}`;
    if (els.bioSlug) els.bioSlug.value = page.slug || '';
    if (els.bioTitle) els.bioTitle.value = page.title || '';
    if (els.bioDescription) els.bioDescription.value = page.description || '';
    if (els.bioAvatar) els.bioAvatar.value = page.avatar_url || '';
    if (els.bioCtaLabel) els.bioCtaLabel.value = page.cta_label || '';
    if (els.bioCtaUrl) els.bioCtaUrl.value = page.cta_url || '';
    if (els.bioActive) els.bioActive.checked = page.is_active !== false;
    setTheme(page.theme || {});
    renderLinks(page.links || []);
  } catch (err) {
    showError(err, 'Failed to load page');
  }
}

function collectPagePayload() {
  return {
    slug: els.bioSlug?.value.trim() || '',
    title: els.bioTitle?.value.trim() || '',
    description: els.bioDescription?.value.trim() || '',
    avatar_url: els.bioAvatar?.value.trim() || '',
    cta_label: els.bioCtaLabel?.value.trim() || '',
    cta_url: els.bioCtaUrl?.value.trim() || '',
    is_active: els.bioActive?.checked !== false,
    theme: readTheme(),
  };
}

async function savePage() {
  if (els.bioSave) els.bioSave.disabled = true;
  if (els.bioSaveMsg) els.bioSaveMsg.textContent = '';
  const payload = collectPagePayload();
  try {
    let res;
    if (currentPage?.id) {
      res = await apiFetch(`/api/bio/${encodeURIComponent(currentPage.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await apiFetch('/api/bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    const page = res?.data;
    if (page) {
      if (currentPage?.id) {
        await saveLinks();
      }
      currentPage = page;
      await loadPages();
      await loadPage(page.id);
      if (els.bioSaveMsg) els.bioSaveMsg.textContent = 'Page saved.';
      showToast('Page saved');
    }
  } catch (err) {
    if (els.bioSaveMsg) els.bioSaveMsg.textContent = 'Failed to save page.';
    showError(err, 'Failed to save page');
  } finally {
    if (els.bioSave) els.bioSave.disabled = false;
  }
}

async function deletePage() {
  if (!currentPage?.id) return;
  if (!confirm('Delete this bio page?')) return;
  try {
    await apiFetch(`/api/bio/${encodeURIComponent(currentPage.id)}`, { method: 'DELETE' });
    showToast('Page deleted');
    clearEditor();
    await loadPages();
  } catch (err) {
    showError(err, 'Failed to delete page');
  }
}

async function addLink() {
  if (!currentPage?.id) {
    showToast('Save the page before adding links', 'warn');
    return;
  }
  try {
    const res = await apiFetch(`/api/bio/${encodeURIComponent(currentPage.id)}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'New link', url: 'https://example.com' }),
    });
    const link = res?.data;
    if (link) {
      currentPage.links = [...(currentPage.links || []), link];
      renderLinks(currentPage.links);
      showToast('Link added');
    }
  } catch (err) {
    showError(err, 'Failed to add link');
  }
}

async function deleteLink(linkId) {
  if (!currentPage?.id || !linkId) return;
  if (!confirm('Remove this link?')) return;
  try {
    await apiFetch(`/api/bio/${encodeURIComponent(currentPage.id)}/links/${encodeURIComponent(linkId)}`, { method: 'DELETE' });
    currentPage.links = (currentPage.links || []).filter((l) => l.id !== linkId);
    renderLinks(currentPage.links);
  } catch (err) {
    showError(err, 'Failed to remove link');
  }
}

async function saveLinks() {
  if (!currentPage?.id) return;
  const rows = Array.from(els.bioLinks?.querySelectorAll('.card') || []);
  for (const row of rows) {
    const id = row.dataset.id;
    if (!id) continue;
    const payload = {
      label: row.querySelector('.link-label')?.value.trim() || '',
      url: row.querySelector('.link-url')?.value.trim() || '',
      icon: row.querySelector('.link-icon')?.value.trim() || '',
      is_active: row.querySelector('.link-active')?.checked !== false,
    };
    await apiFetch(`/api/bio/${encodeURIComponent(currentPage.id)}/links/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
}

async function saveOrder() {
  if (!currentPage?.id) return;
  if (els.bioLinksMsg) els.bioLinksMsg.textContent = '';
  try {
    await saveLinks();
    const rows = Array.from(els.bioLinks?.querySelectorAll('.card') || []);
    const order = rows.map((row) => ({
      id: row.dataset.id,
      sort_order: Number(row.querySelector('.link-order')?.value || 100),
    }));
    await apiFetch(`/api/bio/${encodeURIComponent(currentPage.id)}/links/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    if (els.bioLinksMsg) els.bioLinksMsg.textContent = 'Order saved.';
    showToast('Order saved');
  } catch (err) {
    if (els.bioLinksMsg) els.bioLinksMsg.textContent = 'Failed to save order.';
    showError(err, 'Failed to save order');
  }
}

els.bioRefresh?.addEventListener('click', loadPages);
els.bioNew?.addEventListener('click', clearEditor);
els.bioSave?.addEventListener('click', savePage);
els.bioDelete?.addEventListener('click', deletePage);
els.bioAddLink?.addEventListener('click', addLink);
els.bioReorder?.addEventListener('click', saveOrder);

loadPages();
clearEditor();

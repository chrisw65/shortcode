import { requireAuth, api, showToast, copyToClipboard } from '/admin/admin-common.js?v=20260120';

let state = { config: null };

function renderHeroMetrics() {
  const metrics = {
    webhooks: state.config?.webhooks?.filter((w) => w.enabled).length || 0,
    integrations: state.config?.integrations?.length || 0,
    insights: state.config?.domainHealth?.insights?.length || 0,
  };
  const webhookEl = document.getElementById('webhooksEnabled');
  const integrationEl = document.getElementById('integrationsLive');
  const insightEl = document.getElementById('domainInsights');
  if (webhookEl) webhookEl.textContent = String(metrics.webhooks);
  if (integrationEl) integrationEl.textContent = `${metrics.integrations}`;
  if (insightEl) insightEl.textContent = `${metrics.insights}`;
}

function renderWebhooks() {
  const container = document.getElementById('webhooksList');
  if (!container) return;
  const rows = (state.config?.webhooks || []).map((hook) => `
    <div class="webhook-row" data-webhook-id="${hook.id}">
      <div>
        <strong>${hook.label}</strong>
        <div class="muted small">${hook.description}</div>
      </div>
      <div class="row" style="gap:12px;align-items:center">
        <label class="muted small">
          Endpoint URL
          <input class="input" data-role="webhook-url" data-id="${hook.id}" value="${hook.url || ''}">
        </label>
        <label class="muted small">
          Enabled
          <input type="checkbox" data-role="webhook-enabled" data-id="${hook.id}" ${hook.enabled ? 'checked' : ''}>
        </label>
        <button type="button" class="btn ghost small" data-role="webhook-test" data-id="${hook.id}">Test</button>
      </div>
    </div>
  `).join('');
  container.innerHTML = rows || '<div class="muted">No webhooks configured.</div>';
  container.querySelectorAll('[data-role="webhook-test"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hookId = btn.dataset.id;
      showToast(`Webhook ${hookId} test triggered (simulation).`);
    });
  });
}

function renderIntegrations() {
  const container = document.getElementById('integrationList');
  if (!container) return;
  const items = (state.config?.integrations || []).map((integration) => `
    <div class="integration-card" data-integration-id="${integration.id}">
      <h3>${integration.name}</h3>
      <p class="muted small">${integration.description}</p>
      <label>
        Status
        <select data-role="integration-status" data-id="${integration.id}">
          <option value="enabled">Enabled</option>
          <option value="beta">Beta</option>
          <option value="preview">Preview</option>
          <option value="coming-soon">Coming soon</option>
          <option value="disabled">Disabled</option>
        </select>
      </label>
    </div>
  `).join('');
  container.innerHTML = items || '<div class="muted">No integration catalog entries yet.</div>';
  container.querySelectorAll('[data-role="integration-status"]').forEach((select) => {
    const integration = state.config?.integrations?.find((item) => item.id === select.dataset.id);
    if (integration && integration.status) {
      select.value = integration.status;
    }
  });
}

function renderDomainHealth() {
  const container = document.getElementById('domainHealthGrid');
  const nextInput = document.getElementById('domainNextCheck');
  if (container) {
    container.innerHTML = (state.config?.domainHealth?.insights || []).map((insight) => `
      <div class="tool-card">
        <strong>${insight.label}</strong>
        <p class="muted">${insight.detail}</p>
        <span class="badge">${insight.status}</span>
      </div>
    `).join('');
  }
  if (nextInput) nextInput.value = state.config?.domainHealth?.nextCheck || '';
}

function renderTools() {
  const container = document.getElementById('toolsSection');
  if (!container) return;
  const extension = state.config?.tools?.extension;
  const bookmarklet = state.config?.tools?.bookmarklet;
  container.innerHTML = `
    <div class="tool-card">
      <h3>${extension?.label || 'Browser extension'}</h3>
      <p class="muted">${extension?.description || ''}</p>
      <a class="btn ghost small" href="${extension?.installLink || '#'}" target="_blank" rel="noreferrer">Install guide</a>
    </div>
    <div class="tool-card">
      <h3>${bookmarklet?.label || 'Bookmarklet'}</h3>
      <p class="muted">${bookmarklet?.description || ''}</p>
      <div class="code-block" style="margin-top:12px">
        <code id="bookmarkletCode">${bookmarklet?.snippet || ''}</code>
      </div>
      <button type="button" class="btn ghost small" id="copyBookmarklet">Copy snippet</button>
    </div>
  `;
  const copyBtn = document.getElementById('copyBookmarklet');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const code = document.getElementById('bookmarkletCode')?.textContent || '';
      copyToClipboard(code);
    });
  }
}

function initTabs() {
  const tabButtons = Array.from(document.querySelectorAll('[data-tab]'));
  const tabPanels = Array.from(document.querySelectorAll('[data-panel]'));
  if (!tabButtons.length || !tabPanels.length) return;
  const setActiveTab = (name) => {
    tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tab === name;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    tabPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.panel === name);
    });
    sessionStorage.setItem('ecosystem_tab', name);
  };
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveTab(btn.dataset.tab || 'webhooks');
    });
  });
  const saved = sessionStorage.getItem('ecosystem_tab') || 'webhooks';
  setActiveTab(saved);
}

function gatherWebhooks() {
  const container = document.getElementById('webhooksList');
  if (!container) return [];
  const rows = Array.from(container.querySelectorAll('[data-webhook-id]'));
  return rows.map((row) => {
    const id = row.getAttribute('data-webhook-id');
    const url = row.querySelector('[data-role="webhook-url"]')?.value.trim() || '';
    const enabled = Boolean(row.querySelector('[data-role="webhook-enabled"]')?.checked);
    const base = state.config?.webhooks?.find((hook) => hook.id === id) || {};
    return { ...base, id, url, enabled };
  });
}

function gatherIntegrations() {
  const container = document.getElementById('integrationList');
  if (!container) return [];
  const selects = Array.from(container.querySelectorAll('[data-role="integration-status"]'));
  return selects.map((select) => {
    const id = select.dataset.id;
    const base = state.config?.integrations?.find((item) => item.id === id) || {};
    return { ...base, id, status: select.value };
  });
}

async function saveConfig() {
  if (!state.config) return;
  const payload = {
    ...state.config,
    webhooks: gatherWebhooks(),
    integrations: gatherIntegrations(),
    domainHealth: {
      ...(state.config.domainHealth || {}),
      nextCheck: document.getElementById('domainNextCheck')?.value || '',
    },
  };
  try {
    const res = await api('/api/phase4/ecosystem', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    state.config = res.data;
    render();
    showToast('Ecosystem config saved.');
  } catch (err) {
    showToast((err.message || 'Save failed'), 'error');
  }
}

function render() {
  renderHeroMetrics();
  renderWebhooks();
  renderIntegrations();
  renderDomainHealth();
  renderTools();
}

async function loadConfig() {
  try {
    const res = await api('/api/phase4/ecosystem');
    state.config = res.data;
    render();
  } catch (err) {
    console.error('ecosystem load failed', err);
    const container = document.getElementById('webhooksList');
    if (container) container.innerHTML = '<div class="danger">Failed to load ecosystem config.</div>';
    showToast('Unable to fetch ecosystem config', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  loadConfig();
  document.getElementById('saveConfig')?.addEventListener('click', saveConfig);
  document.getElementById('resetConfig')?.addEventListener('click', loadConfig);
  initTabs();
});

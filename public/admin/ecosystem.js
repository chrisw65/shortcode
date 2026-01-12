import { requireAuth, api, showToast, copyToClipboard } from '/admin/admin-common.js?v=20260120';

let state = { config: null };

function isValidUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateIntegrationSettings(kind, settings) {
  if (kind === 'zapier' || kind === 'slack') {
    return isValidUrl(settings?.webhook_url || '');
  }
  if (kind === 'ga4') {
    if (!settings?.enabled) return true;
    const measurement = String(settings.measurement_id || '');
    const secret = String(settings.api_secret || '');
    return /^G-[A-Z0-9]+$/i.test(measurement) && secret.length >= 8;
  }
  return false;
}

function normalizeIntegrationKey(kind) {
  if (kind === 'google-analytics') return 'ga4';
  return kind;
}

function getIntegrationStatus(kind) {
  const normalized = normalizeIntegrationKey(kind);
  const settings = state.config?.integrationSettings || {};
  if (normalized === 'ga4') {
    const valid = validateIntegrationSettings('ga4', settings.ga4 || {});
    if (!settings.ga4?.enabled) return { label: 'Disabled', tone: 'muted' };
    return valid ? { label: 'Connected', tone: 'ok' } : { label: 'Needs attention', tone: 'warn' };
  }
  const valid = validateIntegrationSettings(normalized, settings[normalized] || {});
  return valid ? { label: 'Connected', tone: 'ok' } : { label: 'Not configured', tone: 'warn' };
}

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
      <div class="row-between" style="margin-top:12px">
        <span class="badge" data-role="integration-pill" data-id="${integration.id}">Status</span>
        <button class="btn ghost small" data-role="integration-config" data-id="${integration.id}">Configure</button>
      </div>
    </div>
  `).join('');
  container.innerHTML = items || '<div class="muted">No integration catalog entries yet.</div>';
  container.querySelectorAll('[data-role="integration-pill"]').forEach((pill) => {
    const id = pill.dataset.id;
    const status = getIntegrationStatus(id);
    pill.textContent = status.label;
    if (status.tone === 'ok') pill.style.borderColor = 'rgba(120,224,143,.6)';
    if (status.tone === 'warn') pill.style.borderColor = 'rgba(255,196,99,.6)';
  });
  container.querySelectorAll('[data-role="integration-config"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = normalizeIntegrationKey(btn.dataset.id);
      const panel = document.getElementById('integrationSettings');
      const target = panel?.querySelector(`[data-role="${id}-section"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.classList.add('pulse');
        setTimeout(() => target.classList.remove('pulse'), 1200);
      }
    });
  });
}

function renderIntegrationSettings() {
  const container = document.getElementById('integrationSettings');
  if (!container) return;
  const settings = state.config?.integrationSettings || {};
  const zapier = settings.zapier || {};
  const slack = settings.slack || {};
  const ga4 = settings.ga4 || {};
  container.innerHTML = `
    <div class="card" data-role="zapier-section">
      <div class="row-between">
        <h4 class="m-0">Zapier</h4>
        <span class="badge" data-role="zapier-status">Not configured</span>
      </div>
      <label class="muted small">
        Catch hook URL
        <input class="input" data-role="zapier-webhook" value="${zapier.webhook_url || ''}" placeholder="https://hooks.zapier.com/...">
      </label>
      <button class="btn ghost small" type="button" data-role="zapier-validate">Validate</button>
    </div>
    <div class="card" data-role="slack-section" style="margin-top:14px">
      <div class="row-between">
        <h4 class="m-0">Slack</h4>
        <span class="badge" data-role="slack-status">Not configured</span>
      </div>
      <label class="muted small">
        Incoming webhook URL
        <input class="input" data-role="slack-webhook" value="${slack.webhook_url || ''}" placeholder="https://hooks.slack.com/...">
      </label>
      <button class="btn ghost small" type="button" data-role="slack-validate">Validate</button>
    </div>
    <div class="card" data-role="ga4-section" style="margin-top:14px">
      <div class="row-between">
        <h4 class="m-0">Google Analytics 4</h4>
        <span class="badge" data-role="ga4-status">Disabled</span>
      </div>
      <label class="muted small">
        Measurement ID
        <input class="input" data-role="ga-measurement" value="${ga4.measurement_id || ''}" placeholder="G-XXXXXXXXXX">
      </label>
      <label class="muted small">
        API secret
        <input class="input" data-role="ga-secret" value="${ga4.api_secret || ''}" placeholder="Your GA4 API secret">
      </label>
      <label class="muted small">
        Enable GA4 events
        <input type="checkbox" data-role="ga-enabled" ${ga4.enabled ? 'checked' : ''}>
      </label>
      <button class="btn ghost small" type="button" data-role="ga4-validate">Validate</button>
    </div>
  `;
  container.querySelector('[data-role="zapier-validate"]')?.addEventListener('click', () => {
    const ok = validateIntegrationSettings('zapier', gatherIntegrationSettings().zapier);
    showToast(ok ? 'Zapier looks good.' : 'Zapier webhook URL is invalid.', ok ? 'ok' : 'error');
  });
  container.querySelector('[data-role="slack-validate"]')?.addEventListener('click', () => {
    const ok = validateIntegrationSettings('slack', gatherIntegrationSettings().slack);
    showToast(ok ? 'Slack looks good.' : 'Slack webhook URL is invalid.', ok ? 'ok' : 'error');
  });
  container.querySelector('[data-role="ga4-validate"]')?.addEventListener('click', () => {
    const ok = validateIntegrationSettings('ga4', gatherIntegrationSettings().ga4);
    showToast(ok ? 'GA4 looks good.' : 'GA4 settings are incomplete.', ok ? 'ok' : 'error');
  });
  const zapierStatus = container.querySelector('[data-role="zapier-status"]');
  const slackStatus = container.querySelector('[data-role="slack-status"]');
  const ga4Status = container.querySelector('[data-role="ga4-status"]');
  const zapierOk = validateIntegrationSettings('zapier', zapier);
  const slackOk = validateIntegrationSettings('slack', slack);
  const ga4Ok = validateIntegrationSettings('ga4', ga4);
  if (zapierStatus) zapierStatus.textContent = zapierOk ? 'Connected' : 'Not configured';
  if (slackStatus) slackStatus.textContent = slackOk ? 'Connected' : 'Not configured';
  if (ga4Status) ga4Status.textContent = ga4.enabled ? (ga4Ok ? 'Connected' : 'Needs attention') : 'Disabled';
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
  return (state.config?.integrations || []).map((item) => ({ ...item }));
}

function gatherIntegrationSettings() {
  const container = document.getElementById('integrationSettings');
  if (!container) return {};
  const zapierWebhook = container.querySelector('[data-role="zapier-webhook"]')?.value.trim() || '';
  const slackWebhook = container.querySelector('[data-role="slack-webhook"]')?.value.trim() || '';
  const gaMeasurement = container.querySelector('[data-role="ga-measurement"]')?.value.trim() || '';
  const gaSecret = container.querySelector('[data-role="ga-secret"]')?.value.trim() || '';
  const gaEnabled = Boolean(container.querySelector('[data-role="ga-enabled"]')?.checked);
  return {
    zapier: { webhook_url: zapierWebhook },
    slack: { webhook_url: slackWebhook },
    ga4: {
      enabled: gaEnabled,
      measurement_id: gaMeasurement,
      api_secret: gaSecret,
    },
  };
}

async function saveConfig() {
  if (!state.config) return;
  const settings = gatherIntegrationSettings();
  const zapierOk = validateIntegrationSettings('zapier', settings.zapier);
  const slackOk = validateIntegrationSettings('slack', settings.slack);
  const ga4Ok = validateIntegrationSettings('ga4', settings.ga4);
  if (settings.ga4?.enabled && !ga4Ok) {
    showToast('GA4 settings need a valid Measurement ID and API secret.', 'error');
    return;
  }
  if (settings.zapier?.webhook_url && !zapierOk) {
    showToast('Zapier webhook URL is invalid.', 'error');
    return;
  }
  if (settings.slack?.webhook_url && !slackOk) {
    showToast('Slack webhook URL is invalid.', 'error');
    return;
  }
  const payload = {
    ...state.config,
    webhooks: gatherWebhooks(),
    integrations: gatherIntegrations(),
    integrationSettings: settings,
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
  renderIntegrationSettings();
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

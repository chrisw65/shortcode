import { requireAuth, api, showToast, copyToClipboard } from '/admin/admin-common.js?v=20260120';

let state = { config: null, webhooks: [], deliveries: [] };

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

function collectEventTypesFromRow(row) {
  const events = [];
  if (row.querySelector('[data-role="event-link-created"]')?.checked) events.push('link.created');
  if (row.querySelector('[data-role="event-link-deleted"]')?.checked) events.push('link.deleted');
  if (row.querySelector('[data-role="event-click-recorded"]')?.checked) events.push('click.recorded');
  return events;
}

function collectEventTypesFromCreate() {
  const events = [];
  if (document.getElementById('eventLinkCreated')?.checked) events.push('link.created');
  if (document.getElementById('eventLinkDeleted')?.checked) events.push('link.deleted');
  if (document.getElementById('eventClickRecorded')?.checked) events.push('click.recorded');
  return events;
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
    webhooks: state.webhooks?.filter((w) => w.enabled).length || 0,
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
  if (!state.webhooks.length) {
    container.innerHTML = '<div class="muted">No webhooks configured.</div>';
    return;
  }
  container.innerHTML = state.webhooks.map((hook) => {
    const events = hook.event_types && hook.event_types.length
      ? hook.event_types
      : ['link.created', 'link.deleted', 'click.recorded'];
    return `
    <div class="webhook-row" data-webhook-id="${hook.id}">
      <div>
        <strong>${hook.name || 'Webhook'}</strong>
        <div class="muted small">${hook.url || ''}</div>
        <div class="row" style="gap:12px;margin-top:8px;flex-wrap:wrap">
          <label class="muted small"><input type="checkbox" data-role="event-link-created" ${events.includes('link.created') ? 'checked' : ''}> link.created</label>
          <label class="muted small"><input type="checkbox" data-role="event-link-deleted" ${events.includes('link.deleted') ? 'checked' : ''}> link.deleted</label>
          <label class="muted small"><input type="checkbox" data-role="event-click-recorded" ${events.includes('click.recorded') ? 'checked' : ''}> click.recorded</label>
        </div>
      </div>
      <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">
        <input class="input" style="min-width:260px" data-role="webhook-name" value="${hook.name || ''}" placeholder="Name">
        <input class="input" style="min-width:320px" data-role="webhook-url" value="${hook.url || ''}" placeholder="https://">
        <label class="muted small">
          Enabled
          <input type="checkbox" data-role="webhook-enabled" ${hook.enabled ? 'checked' : ''}>
        </label>
        <button type="button" class="btn ghost small" data-role="webhook-save" data-id="${hook.id}">Save</button>
        <button type="button" class="btn ghost small" data-role="webhook-test" data-id="${hook.id}">Test</button>
        <button type="button" class="btn ghost small" data-role="webhook-rotate" data-id="${hook.id}">Rotate secret</button>
        <button type="button" class="btn danger small" data-role="webhook-delete" data-id="${hook.id}">Delete</button>
      </div>
    </div>
    `;
  }).join('');

  container.querySelectorAll('[data-role="webhook-test"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const hookId = btn.dataset.id;
      await testWebhook(hookId);
    });
  });
  container.querySelectorAll('[data-role="webhook-save"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('[data-webhook-id]');
      const hookId = btn.dataset.id;
      if (!row || !hookId) return;
      await updateWebhook(hookId, row);
    });
  });
  container.querySelectorAll('[data-role="webhook-rotate"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const hookId = btn.dataset.id;
      if (!hookId) return;
      await rotateWebhookSecret(hookId);
    });
  });
  container.querySelectorAll('[data-role="webhook-delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const hookId = btn.dataset.id;
      if (!hookId) return;
      await deleteWebhook(hookId);
    });
  });
}

function renderDeliveries() {
  const body = document.getElementById('webhookDeliveries');
  if (!body) return;
  if (!state.deliveries.length) {
    body.innerHTML = '<tr><td colspan="5" class="muted">No deliveries yet.</td></tr>';
    return;
  }
  body.innerHTML = state.deliveries.map((d) => {
    const when = d.last_attempt_at ? new Date(d.last_attempt_at).toLocaleString() : '-';
    const response = d.response_status ? String(d.response_status) : '-';
    return `
      <tr>
        <td>${d.event_type}</td>
        <td>${d.status}</td>
        <td>${d.attempt_count}/${d.max_attempts}</td>
        <td>${when}</td>
        <td>${response}</td>
      </tr>
    `;
  }).join('');
}

async function loadWebhooks() {
  try {
    const res = await api('/api/webhooks');
    state.webhooks = res.data || [];
    renderWebhooks();
    renderHeroMetrics();
  } catch (err) {
    const container = document.getElementById('webhooksList');
    if (container) container.innerHTML = '<div class="danger">Failed to load webhooks.</div>';
    showToast('Unable to fetch webhooks', 'error');
  }
}

async function loadDeliveries() {
  try {
    const res = await api('/api/webhooks/deliveries?limit=50');
    state.deliveries = res.data || [];
    renderDeliveries();
  } catch (err) {
    const body = document.getElementById('webhookDeliveries');
    if (body) body.innerHTML = '<tr><td colspan="5" class="muted">Failed to load deliveries.</td></tr>';
  }
}

async function createWebhook() {
  const name = document.getElementById('webhookName')?.value.trim();
  const url = document.getElementById('webhookUrl')?.value.trim();
  const enabled = document.getElementById('webhookEnabled')?.value === 'true';
  const events = collectEventTypesFromCreate();
  const msg = document.getElementById('webhookCreateMsg');
  if (msg) msg.textContent = '';
  if (!name || !url) {
    if (msg) msg.textContent = 'Name and URL are required.';
    return;
  }
  try {
    const res = await api('/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, enabled, event_types: events }),
    });
    if (res?.data?.secret) {
      copyToClipboard(res.data.secret);
      if (msg) msg.textContent = 'Webhook created. Secret copied to clipboard.';
    } else if (msg) {
      msg.textContent = 'Webhook created.';
    }
    await loadWebhooks();
  } catch (err) {
    if (msg) msg.textContent = err.message || 'Failed to create webhook.';
  }
}

async function updateWebhook(id, row) {
  const name = row.querySelector('[data-role="webhook-name"]')?.value.trim();
  const url = row.querySelector('[data-role="webhook-url"]')?.value.trim();
  const enabled = Boolean(row.querySelector('[data-role="webhook-enabled"]')?.checked);
  const events = collectEventTypesFromRow(row);
  try {
    await api(`/api/webhooks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, enabled, event_types: events }),
    });
    showToast('Webhook updated.');
    await loadWebhooks();
  } catch (err) {
    showToast(err.message || 'Failed to update webhook.', 'error');
  }
}

async function rotateWebhookSecret(id) {
  try {
    const res = await api(`/api/webhooks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotate_secret: true }),
    });
    if (res?.data?.secret) {
      copyToClipboard(res.data.secret);
      showToast('Secret rotated and copied.');
    } else {
      showToast('Secret rotated.');
    }
  } catch (err) {
    showToast(err.message || 'Failed to rotate secret.', 'error');
  }
}

async function deleteWebhook(id) {
  if (!confirm('Delete this webhook?')) return;
  try {
    await api(`/api/webhooks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast('Webhook deleted.');
    await loadWebhooks();
  } catch (err) {
    showToast(err.message || 'Failed to delete webhook.', 'error');
  }
}

async function testWebhook(id) {
  try {
    await api(`/api/webhooks/${encodeURIComponent(id)}/test`, { method: 'POST' });
    showToast('Webhook test queued.');
    await loadDeliveries();
  } catch (err) {
    showToast(err.message || 'Failed to send test.', 'error');
  }
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
  renderDeliveries();
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
  loadWebhooks();
  loadDeliveries();
  document.getElementById('saveConfig')?.addEventListener('click', saveConfig);
  document.getElementById('resetConfig')?.addEventListener('click', loadConfig);
  document.getElementById('createWebhookBtn')?.addEventListener('click', createWebhook);
  document.getElementById('refreshDeliveries')?.addEventListener('click', loadDeliveries);
  initTabs();
});

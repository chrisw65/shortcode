import { requireAuth, api, mountNav, htmlesc, showToast } from '/admin/admin-common.js?v=20260120';

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  mountNav('domains');

  const domainEl = document.getElementById('domain');
  const addBtn   = document.getElementById('addBtn');
  const addMsg   = document.getElementById('addMsg');
  const domainWizard = document.getElementById('domainWizard');
  const domainWizardBadge = document.getElementById('domainWizardBadge');
  const domainWizardPrev = document.getElementById('domainWizardPrev');
  const domainWizardNext = document.getElementById('domainWizardNext');
  const domainWizardSteps = Array.from(document.querySelectorAll('.wizard-step'));
  const domainWizardPanels = Array.from(document.querySelectorAll('.wizard-panel'));
  const domainTxtHost = document.getElementById('domainTxtHost');
  const domainTxtValue = document.getElementById('domainTxtValue');
  const copyTxtHost = document.getElementById('copyTxtHost');
  const copyTxtValue = document.getElementById('copyTxtValue');
  const dnsHint = document.getElementById('dnsHint');
  const validateBtn = document.getElementById('validateBtn');
  const validateMsg = document.getElementById('validateMsg');
  const validateStatus = document.getElementById('validateStatus');
  const validateCountdown = document.getElementById('validateCountdown');
  const dnsCheckTxt = document.getElementById('dnsCheckTxt');
  const dnsCheckCname = document.getElementById('dnsCheckCname');
  const dnsCheckA = document.getElementById('dnsCheckA');
  const dnsCheckAAAA = document.getElementById('dnsCheckAAAA');
  const dnsCheckHint = document.getElementById('dnsCheckHint');
  const tbody    = document.getElementById('tbody');
  const whoami   = document.getElementById('whoami');

  // Hard assertions with helpful console output
  if (!domainEl || !addBtn || !addMsg || !tbody) {
    console.error('domains.js: missing required DOM nodes', {
      domainEl: !!domainEl, addBtn: !!addBtn, addMsg: !!addMsg, tbody: !!tbody
    });
    // Avoid throwing; show a user-facing error row if tbody exists
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" class="danger">DOM error: reload page (⌘⇧R).</td></tr>';
    }
    return;
  }

  let list = [];
  let effectivePlan = 'free';
  let uiMode = 'beginner';
  let createdDomain = null;
  let wizardStep = 1;
  const POLL_INTERVAL_FAST_MS = 20000;
  const POLL_INTERVAL_SLOW_MS = 60000;
  const POLL_FAST_WINDOW_MS = 5 * 60 * 1000;
  const DNS_CHECK_INTERVAL_MS = 90000;
  let pollTimer = null;
  let countdownTimer = null;
  let nextPollAt = 0;
  let lastDnsCheckAt = 0;
  let pollStartedAt = 0;
  const statusMap = new Map();

  function isPaid() {
    return String(effectivePlan || '').toLowerCase() !== 'free';
  }

  function currentPollInterval() {
    if (!pollStartedAt) return POLL_INTERVAL_FAST_MS;
    return Date.now() - pollStartedAt >= POLL_FAST_WINDOW_MS
      ? POLL_INTERVAL_SLOW_MS
      : POLL_INTERVAL_FAST_MS;
  }

  function scheduleNextPoll() {
    if (!pollStartedAt) return;
    const interval = currentPollInterval();
    nextPollAt = Date.now() + interval;
    pollTimer = window.setTimeout(async () => {
      pollTimer = null;
      if (!document.hidden) {
        await refreshDomainsOnly();
      }
      if (pollStartedAt) scheduleNextPoll();
    }, interval);
  }

  function startPolling() {
    if (pollTimer) return;
    if (!pollStartedAt) pollStartedAt = Date.now();
    scheduleNextPoll();
    if (!countdownTimer) {
      countdownTimer = window.setInterval(() => {
        if (!validateCountdown) return;
        if (!pollTimer) {
          validateCountdown.textContent = '';
          return;
        }
        const remaining = Math.max(0, Math.ceil((nextPollAt - Date.now()) / 1000));
        validateCountdown.textContent = remaining ? `Next auto-check in ${remaining}s` : 'Next auto-check soon';
      }, 1000);
    }
  }

  function stopPolling() {
    if (pollTimer) {
      window.clearTimeout(pollTimer);
      pollTimer = null;
    }
    pollStartedAt = 0;
    if (countdownTimer) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (validateCountdown) validateCountdown.textContent = '';
  }

  function handleVerificationTransitions(nextList) {
    const pending = nextList.some((item) => !item.verified);
    nextList.forEach((item) => {
      const prev = statusMap.get(item.id);
      if (prev === false && item.verified) {
        showToast(`Domain verified: ${item.domain}`);
      }
      statusMap.set(item.id, !!item.verified);
    });
    if (pending) startPolling();
    else stopPolling();
  }

  async function load() {
    try {
      const me = await api('/api/auth/me');
      const meData = me?.data || {};
      effectivePlan = meData.effective_plan || meData.user?.plan || 'free';
      if (whoami) {
        whoami.textContent = `Plan: ${effectivePlan}`;
      }
      if (meData?.user?.is_superadmin) {
        try {
          const platform = await api('/api/platform-config');
          uiMode = platform?.data?.ui_mode === 'expert' ? 'expert' : 'beginner';
        } catch (e) {
          uiMode = 'beginner';
        }
      }
      setDomainWizardMode(uiMode);

      if (!isPaid()) {
        addBtn.disabled = true;
        addMsg.textContent = 'Custom domains require a paid plan.';
      } else {
        addBtn.disabled = false;
        if (!addMsg.textContent.includes('Custom domains')) addMsg.textContent = '';
      }

      const j = await api('/api/domains');
      list = Array.isArray(j.data) ? j.data : [];
      if (createdDomain) {
        const updated = list.find((item) => item.id === createdDomain.id);
        if (updated) createdDomain = updated;
      }
      render();
      updateWizardFromDomain();
      handleVerificationTransitions(list);
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="danger">Failed to load: ${htmlesc(e.message || 'unknown')}</td></tr>`;
    }
  }

  async function refreshDomainsOnly() {
    try {
      const j = await api('/api/domains');
      list = Array.isArray(j.data) ? j.data : [];
      if (createdDomain) {
        const updated = list.find((item) => item.id === createdDomain.id);
        if (updated) createdDomain = updated;
      }
      render();
      updateWizardFromDomain();
      handleVerificationTransitions(list);
      if (createdDomain && !createdDomain.verified) {
        runDnsCheck(createdDomain.id);
      }
    } catch (e) {
      console.warn('Domain polling failed', e);
    }
  }

  function setDomainWizardStep(step) {
    if (!domainWizard) return;
    const maxStep = domainWizardPanels.length || 1;
    wizardStep = Math.min(Math.max(step, 1), maxStep);
    domainWizard.dataset.step = String(wizardStep);
    domainWizardSteps.forEach((btn) => {
      const active = Number(btn.dataset.step) === wizardStep;
      btn.classList.toggle('active', active);
    });
    domainWizardPanels.forEach((panel) => {
      const active = Number(panel.dataset.step) === wizardStep;
      panel.classList.toggle('active', active);
    });
    if (domainWizardPrev) domainWizardPrev.disabled = wizardStep <= 1;
    if (domainWizardNext) {
      const allowNext = wizardStep < maxStep && (wizardStep !== 1 || !!createdDomain);
      domainWizardNext.disabled = !allowNext;
    }
  }

  function setDomainWizardMode(mode) {
    if (!domainWizard) return;
    const expert = mode === 'expert';
    domainWizard.classList.toggle('wizard-expert', expert);
    if (domainWizardBadge) domainWizardBadge.textContent = expert ? 'Expert mode' : 'Beginner mode';
    if (expert) {
      domainWizardPanels.forEach((panel) => panel.classList.add('active'));
    } else {
      domainWizardPanels.forEach((panel) => panel.classList.remove('active'));
      setDomainWizardStep(wizardStep || 1);
    }
  }

  function updateWizardFromDomain() {
    if (!createdDomain) {
      if (domainTxtHost) domainTxtHost.value = '';
      if (domainTxtValue) domainTxtValue.value = '';
      if (dnsHint) dnsHint.textContent = 'Add a domain to generate your verification token.';
      if (dnsCheckHint) dnsCheckHint.textContent = '';
      if (dnsCheckTxt) dnsCheckTxt.textContent = '—';
      if (dnsCheckCname) dnsCheckCname.textContent = '—';
      if (dnsCheckA) dnsCheckA.textContent = '—';
      if (dnsCheckAAAA) dnsCheckAAAA.textContent = '—';
      if (validateStatus) validateStatus.textContent = '';
      if (validateBtn) validateBtn.disabled = true;
      return;
    }
    if (domainTxtHost) domainTxtHost.value = `_shortlink.${createdDomain.domain}`;
    if (domainTxtValue) domainTxtValue.value = createdDomain.verification_token || '';
    if (dnsHint) dnsHint.textContent = 'DNS propagation can take a few minutes to a few hours.';
    if (validateBtn) validateBtn.disabled = false;
    if (validateStatus) {
      validateStatus.textContent = createdDomain.verified
        ? 'Verified. Your domain is ready to use.'
        : 'Pending. Click validate after DNS propagates.';
    }
    if (!domainWizard?.classList.contains('wizard-expert')) {
      if (wizardStep === 1) setDomainWizardStep(2);
    }
    if (!createdDomain.verified) {
      runDnsCheck(createdDomain.id);
      startPolling();
    }
    else stopPolling();
  }

  async function runDnsCheck(id, force = false) {
    if (!id) return;
    const now = Date.now();
    if (!force && now - lastDnsCheckAt < DNS_CHECK_INTERVAL_MS) return;
    lastDnsCheckAt = now;
    try {
      const res = await api(`/api/domains/${id}/check`);
      const data = res?.data || res || {};
      const txtOk = data?.txt?.host_match || data?.txt?.root_match;
      if (dnsCheckTxt) dnsCheckTxt.textContent = txtOk ? 'Found' : 'Missing';
      if (dnsCheckCname) {
        if (data?.cname?.target) {
          dnsCheckCname.textContent = data?.cname?.matches ? 'Matches' : 'No match';
        } else {
          dnsCheckCname.textContent = data?.cname?.records?.length ? 'Present' : 'Not set';
        }
      }
      if (dnsCheckA) {
        dnsCheckA.textContent = data?.a_records?.records?.length ? 'Present' : 'Not set';
      }
      if (dnsCheckAAAA) {
        dnsCheckAAAA.textContent = data?.aaaa_records?.records?.length ? 'Present' : 'Not set';
      }
      if (dnsCheckHint) {
        const cnameTarget = data?.cname?.target;
        dnsCheckHint.textContent = cnameTarget
          ? `CNAME should point to ${cnameTarget}`
          : 'CNAME target not configured. A/AAAA records may be used instead.';
      }
    } catch (e) {
      if (dnsCheckHint) dnsCheckHint.textContent = 'DNS check failed. Try again in a moment.';
    }
  }

  async function copyInputValue(inputEl, messageEl, label) {
    if (!inputEl || !inputEl.value) return;
    const value = inputEl.value;
    try {
      await navigator.clipboard.writeText(value);
      if (messageEl) messageEl.textContent = `${label} copied.`;
    } catch (e) {
      inputEl.select();
      document.execCommand('copy');
      if (messageEl) messageEl.textContent = `${label} copied.`;
    }
  }

  function render() {
    tbody.innerHTML = '';
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No domains.</td></tr>';
      return;
    }

    for (const d of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${htmlesc(d.domain)}</td>
        <td>${d.verified ? '<span class="badge">Verified</span>' : '<span class="badge">Pending</span>'}</td>
        <td style="text-align:center">${d.is_default ? '✅' : ''}</td>
        <td><code>${htmlesc(d.verification_token || '')}</code></td>
        <td class="row" style="justify-content:end;gap:8px">
          ${!d.verified ? `<button class="btn" data-act="check" data-id="${htmlesc(d.id)}">Verify</button>` : ''}
          ${!d.is_default ? `<button class="btn" data-act="default" data-id="${htmlesc(d.id)}">Make default</button>` : ''}
          <button class="btn" data-act="delete" data-id="${htmlesc(d.id)}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    // Bind actions
    tbody.querySelectorAll('button[data-act]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.id;
        try {
          if (b.dataset.act === 'check') {
            await verifyDomain(id);
          } else if (b.dataset.act === 'default') {
            await api(`/api/domains/${id}/default`, { method: 'POST' });
            await load();
          } else if (b.dataset.act === 'delete') {
            if (!confirm('Delete domain?')) return;
            await api(`/api/domains/${id}`, { method: 'DELETE' });
            list = list.filter(x => x.id !== id);
            render();
          }
        } catch (e) {
          alert((b.dataset.act || 'Action') + ' failed: ' + (e.message || 'unknown'));
        }
      });
    });
  }

  async function verifyDomain(id) {
    if (!id) return;
    if (validateMsg) validateMsg.textContent = '';
    if (validateBtn) validateBtn.disabled = true;
    try {
      const res = await api(`/api/domains/${id}/verify`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({}),
      });
      const updated = res?.data || res;
      if (createdDomain && updated?.id === createdDomain.id) {
        createdDomain = { ...createdDomain, ...updated };
      }
      await load();
      if (validateMsg) {
        validateMsg.textContent = updated?.verified ? 'Verified.' : 'Still pending. Try again soon.';
      }
    } catch (e) {
      if (validateMsg) validateMsg.textContent = e?.message || 'Validation failed.';
    } finally {
      if (validateBtn) validateBtn.disabled = false;
    }
  }

  async function add() {
    addMsg.textContent = '';
    const domain = (domainEl.value || '').trim().toLowerCase();
    if (!isPaid()) {
      addMsg.textContent = 'Custom domains require a paid plan.';
      return;
    }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
      addMsg.textContent = 'Enter a valid domain';
      return;
    }
    addBtn.disabled = true;
    try {
      const j = await api('/api/domains', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ domain, make_default: false })
      });
      createdDomain = j.data || null;
      list.unshift(j.data);
      render();
      updateWizardFromDomain();
      if (createdDomain?.id) {
        runDnsCheck(createdDomain.id, true);
      }
      if (j.automation && j.automation.status === 'created') {
        addMsg.textContent = 'DNS records created automatically. You can verify now.';
      } else if (j.automation && j.automation.status === 'error') {
        addMsg.textContent = 'DNS automation failed; use manual TXT setup.';
      } else {
        addMsg.textContent = '';
      }
      domainEl.value = '';
    } catch (e) {
      addMsg.textContent = e.message || 'Add failed';
    } finally {
      addBtn.disabled = false;
    }
  }

  addBtn.addEventListener('click', add);
  domainWizardSteps.forEach((btn) => {
    btn.addEventListener('click', () => setDomainWizardStep(Number(btn.dataset.step) || 1));
  });
  domainWizardPrev?.addEventListener('click', () => setDomainWizardStep(wizardStep - 1));
  domainWizardNext?.addEventListener('click', () => setDomainWizardStep(wizardStep + 1));
  copyTxtHost?.addEventListener('click', () => copyInputValue(domainTxtHost, dnsHint, 'Host'));
  copyTxtValue?.addEventListener('click', () => copyInputValue(domainTxtValue, dnsHint, 'Value'));
  validateBtn?.addEventListener('click', async () => {
    if (!createdDomain?.id) return;
    await runDnsCheck(createdDomain.id, true);
    await verifyDomain(createdDomain.id);
  });
  setDomainWizardMode('beginner');
  setDomainWizardStep(1);
  load();
});

import { requireAuth, api, showToast } from '/admin/admin-common.js?v=20260120';

requireAuth();

const els = {
  linkModeInputs: Array.from(document.querySelectorAll('input[name="amazonLinkMode"]')),
  existingWrap: document.getElementById('amazonExistingWrap'),
  createWrap: document.getElementById('amazonCreateWrap'),
  linkFilter: document.getElementById('linkFilter'),
  linkSelect: document.getElementById('amazonLinkSelect'),
  linkDetails: document.getElementById('linkDetails'),
  refreshLinks: document.getElementById('refreshLinks'),
  refreshRoutes: document.getElementById('refreshRoutes'),
  shortCode: document.getElementById('amazonShortCode'),
  title: document.getElementById('amazonTitle'),
  domainSelect: document.getElementById('amazonDomainSelect'),
  codeStatus: document.getElementById('amazonCodeStatus'),
  codePreview: document.getElementById('amazonCodePreview'),
  createLink: document.getElementById('amazonCreateLink'),
  linkMsg: document.getElementById('amazonLinkMsg'),
  asin: document.getElementById('amazonAsin'),
  destination: document.getElementById('amazonDestination'),
  previewMarket: document.getElementById('amazonPreviewMarket'),
  previewFrame: document.getElementById('amazonPreviewFrame'),
  previewUrl: document.getElementById('amazonPreviewUrl'),
  previewLink: document.getElementById('amazonPreviewLink'),
  previewNotice: document.getElementById('amazonPreviewNotice'),
  applyRoutes: document.getElementById('applyRoutes'),
  replaceExisting: document.getElementById('replaceExisting'),
  routesMsg: document.getElementById('amazonRoutesMsg'),
  routesTable: document.getElementById('amazonRoutesTable'),
};

const AMAZON_MARKETS = [
  { code: 'US', domain: 'amazon.com', label: 'United States' },
  { code: 'GB', domain: 'amazon.co.uk', label: 'United Kingdom' },
  { code: 'DE', domain: 'amazon.de', label: 'Germany' },
  { code: 'FR', domain: 'amazon.fr', label: 'France' },
  { code: 'IT', domain: 'amazon.it', label: 'Italy' },
  { code: 'ES', domain: 'amazon.es', label: 'Spain' },
  { code: 'CA', domain: 'amazon.ca', label: 'Canada' },
  { code: 'AU', domain: 'amazon.com.au', label: 'Australia' },
  { code: 'JP', domain: 'amazon.co.jp', label: 'Japan' },
  { code: 'IN', domain: 'amazon.in', label: 'India' },
  { code: 'BR', domain: 'amazon.com.br', label: 'Brazil' },
  { code: 'MX', domain: 'amazon.com.mx', label: 'Mexico' },
  { code: 'NL', domain: 'amazon.nl', label: 'Netherlands' },
  { code: 'SG', domain: 'amazon.sg', label: 'Singapore' },
  { code: 'AE', domain: 'amazon.ae', label: 'United Arab Emirates' },
  { code: 'SA', domain: 'amazon.sa', label: 'Saudi Arabia' },
  { code: 'SE', domain: 'amazon.se', label: 'Sweden' },
  { code: 'PL', domain: 'amazon.pl', label: 'Poland' },
  { code: 'TR', domain: 'amazon.com.tr', label: 'Turkey' },
];

let links = [];
let currentRoutes = [];
let previewTimer = null;
let availabilityTimer = null;
let coreHost = 'https://okleaf.link';
let effectivePlan = 'free';
let domains = [];
let linkMode = 'existing';

function htmlesc(str) {
  return String(str || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));
}

function normalizeAsin(value) {
  return String(value || '').trim().toUpperCase();
}

function setCodeStatus(state, text) {
  if (!els.codeStatus) return;
  els.codeStatus.className = `status ${state || 'warn'}`;
  els.codeStatus.textContent = text || '';
}

function selectedDomain() {
  const value = (els.domainSelect?.value || '').trim();
  if (!value) return { id: '', host: coreHost.replace(/^https?:\/\//, '') };
  const hit = domains.find((d) => d.id === value);
  return { id: value, host: (hit?.domain || coreHost).replace(/^https?:\/\//, '') };
}

function updateCodePreview() {
  if (!els.codePreview) return;
  const code = (els.shortCode?.value || '').trim();
  const host = selectedDomain().host;
  const shown = code || 'your-code';
  els.codePreview.innerHTML = `Short URL: https://${htmlesc(host)}/${htmlesc(shown)}`;
  if (!code) {
    setCodeStatus('warn', `Auto-generate on ${host}.`);
  }
}

function renderDomainSelect() {
  if (!els.domainSelect) return;
  const options = [];
  const coreLabel = coreHost.replace(/^https?:\/\//, '');
  options.push(`<option value="">${htmlesc(coreLabel)} (core)</option>`);
  const available = domains.filter((d) => d.verified && d.is_active);
  if (String(effectivePlan || '').toLowerCase() !== 'free') {
    available.forEach((d) => {
      options.push(`<option value="${htmlesc(d.id)}">${htmlesc(d.domain)}</option>`);
    });
  }
  els.domainSelect.innerHTML = options.join('');
  els.domainSelect.disabled = String(effectivePlan || '').toLowerCase() === 'free';
  updateCodePreview();
}

function resolveAmazonDomain(marketCode) {
  const market = AMAZON_MARKETS.find((m) => m.code === marketCode);
  return market ? market.domain : '';
}

function buildAmazonUrl(asin, destination, marketCode) {
  const domain = resolveAmazonDomain(marketCode);
  if (!asin || !domain) return '';
  if (destination === 'reviews') {
    return `https://${domain}/product-reviews/${asin}`;
  }
  if (destination === 'write-review') {
    return `https://${domain}/review/create-review?asin=${asin}`;
  }
  if (destination === 'purchases-review') {
    return `https://${domain}/review/review-your-purchases/?asin=${asin}`;
  }
  return `https://${domain}/dp/${asin}`;
}

function getSelectedMarkets() {
  return Array.from(document.querySelectorAll('.amazon-market'))
    .filter((input) => input.checked)
    .map((input) => input.getAttribute('data-market'))
    .filter(Boolean);
}

function updatePreview() {
  const asin = normalizeAsin(els.asin?.value);
  const destination = els.destination?.value || 'product';
  const market = els.previewMarket?.value || 'US';
  const url = buildAmazonUrl(asin, destination, market);
  if (els.previewUrl) els.previewUrl.textContent = url || 'Enter an ASIN to preview.';
  if (els.previewLink) els.previewLink.href = url || '#';
  if (els.previewFrame) els.previewFrame.src = url || 'about:blank';
  if (els.previewNotice) els.previewNotice.style.display = 'none';
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    if (els.previewNotice) els.previewNotice.style.display = url ? 'block' : 'none';
  }, 1500);
}

function initPreviewMarkets() {
  if (!els.previewMarket) return;
  els.previewMarket.innerHTML = '';
  AMAZON_MARKETS.forEach((market) => {
    const opt = document.createElement('option');
    opt.value = market.code;
    opt.textContent = `${market.code} - ${market.label}`;
    els.previewMarket.appendChild(opt);
  });
  els.previewMarket.value = 'US';
}

function filterLinks(term) {
  const query = term.trim().toLowerCase();
  if (!query) return links;
  return links.filter((link) => {
    return String(link.short_code || '').toLowerCase().includes(query)
      || String(link.title || '').toLowerCase().includes(query);
  });
}

function renderLinkOptions(list) {
  if (!els.linkSelect) return;
  els.linkSelect.innerHTML = '';
  if (!list.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No links available';
    els.linkSelect.appendChild(opt);
    return;
  }
  list.forEach((link) => {
    const opt = document.createElement('option');
    opt.value = link.short_code;
    const label = link.title ? `${link.short_code} - ${link.title}` : link.short_code;
    opt.textContent = label;
    els.linkSelect.appendChild(opt);
  });
}

function setLinkDetails(link) {
  if (!els.linkDetails) return;
  if (!link) {
    els.linkDetails.textContent = 'No link selected.';
    return;
  }
  const target = link.original_url || '';
  els.linkDetails.textContent = `Target: ${target}`;
}

async function loadLinks() {
  try {
    const res = await api('/api/links');
    links = res?.data || [];
    const filtered = filterLinks(els.linkFilter?.value || '');
    renderLinkOptions(filtered);
    const first = filtered[0];
    if (first && els.linkSelect) {
      els.linkSelect.value = first.short_code;
      setLinkDetails(first);
      await loadRoutesForLink(first.short_code);
    }
  } catch (err) {
    showToast('Failed to load links', 'error');
  }
}

async function loadContext() {
  try {
    const [coreRes, meRes, domainRes] = await Promise.all([
      api('/api/links/core-domain'),
      api('/api/auth/me'),
      api('/api/domains'),
    ]);
    const core = coreRes?.data || {};
    if (core.base_url) coreHost = core.base_url;
    const me = meRes?.data || {};
    effectivePlan = me.effective_plan || me.user?.plan || 'free';
    const list = domainRes?.data || [];
    domains = Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('Failed to load context', err);
  } finally {
    renderDomainSelect();
    updateCodePreview();
  }
}

async function loadRoutesForLink(shortCode) {
  if (!shortCode) {
    currentRoutes = [];
    renderRoutesTable();
    return;
  }
  try {
    const res = await api(`/api/links/${encodeURIComponent(shortCode)}/routes`);
    currentRoutes = Array.isArray(res?.data) ? res.data : res || [];
    renderRoutesTable();
  } catch (err) {
    currentRoutes = [];
    renderRoutesTable();
  }
}

function renderRoutesTable() {
  if (!els.routesTable) return;
  const list = currentRoutes.filter((route) => String(route.rule_type || '').toLowerCase() === 'country');
  if (!list.length) {
    els.routesTable.innerHTML = '<tr><td colspan="3" class="muted">No country routes found.</td></tr>';
    return;
  }
  els.routesTable.innerHTML = list.map((route) => {
    return `<tr>
      <td>${route.rule_value}</td>
      <td>${route.destination_url}</td>
      <td>${route.active !== false ? 'Yes' : 'No'}</td>
    </tr>`;
  }).join('');
}

async function createLink() {
  const asin = normalizeAsin(els.asin?.value);
  if (!asin) {
    if (els.linkMsg) els.linkMsg.textContent = 'Enter an ASIN before creating the link.';
    return null;
  }
  const destination = els.destination?.value || 'product';
  const market = els.previewMarket?.value || getSelectedMarkets()[0] || 'US';
  const url = buildAmazonUrl(asin, destination, market);
  if (!url) {
    if (els.linkMsg) els.linkMsg.textContent = 'Unable to build the Amazon URL.';
    return null;
  }
  const shortCode = (els.shortCode?.value || '').trim();
  const title = (els.title?.value || '').trim() || `Amazon ASIN ${asin}`;
  const domain = selectedDomain();
  if (els.linkMsg) els.linkMsg.textContent = '';
  if (els.createLink) els.createLink.disabled = true;
  try {
    const body = { url, title };
    if (shortCode) body.short_code = shortCode;
    if (domain.id) body.domain_id = domain.id;
    const res = await api('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const created = res?.data;
    if (created?.short_code) {
      links = [created, ...links];
      renderLinkOptions(filterLinks(els.linkFilter?.value || ''));
      if (els.linkSelect) {
        els.linkSelect.value = created.short_code;
      }
      setLinkDetails(created);
      await loadRoutesForLink(created.short_code);
      if (els.linkMsg) els.linkMsg.textContent = `Created ${created.short_code}.`;
      setLinkMode('existing');
      return created.short_code;
    }
    if (els.linkMsg) els.linkMsg.textContent = 'Link created, but response was missing a short code.';
    return null;
  } catch (err) {
    if (els.linkMsg) els.linkMsg.textContent = err.message || 'Failed to create link.';
    return null;
  } finally {
    if (els.createLink) els.createLink.disabled = false;
  }
}

async function applyRoutes() {
  let shortCode = els.linkSelect?.value;
  if (linkMode === 'new') {
    shortCode = await createLink();
  }
  if (!shortCode) return;
  const asin = normalizeAsin(els.asin?.value);
  if (!asin) {
    if (els.routesMsg) els.routesMsg.textContent = 'Enter an ASIN to generate routes.';
    return;
  }
  const destination = els.destination?.value || 'product';
  const markets = getSelectedMarkets();
  if (!markets.length) {
    if (els.routesMsg) els.routesMsg.textContent = 'Select at least one marketplace.';
    return;
  }
  const replace = els.replaceExisting?.checked !== false;

  let nextRoutes = Array.isArray(currentRoutes) ? [...currentRoutes] : [];
  if (replace) {
    nextRoutes = nextRoutes.filter((route) => {
      if (String(route.rule_type || '').toLowerCase() !== 'country') return true;
      return !markets.includes(String(route.rule_value || '').toUpperCase());
    });
  }

  markets.forEach((market) => {
    const url = buildAmazonUrl(asin, destination, market);
    if (!url) return;
    if (!replace) {
      const exists = nextRoutes.find((route) => {
        return String(route.rule_type || '').toLowerCase() === 'country'
          && String(route.rule_value || '').toUpperCase() === market
          && String(route.destination_url || '') === url;
      });
      if (exists) return;
    }
    nextRoutes.push({
      rule_type: 'country',
      rule_value: market,
      destination_url: url,
      priority: 100,
      active: true,
    });
  });

  if (els.routesMsg) els.routesMsg.textContent = '';
  try {
    await api(`/api/links/${encodeURIComponent(shortCode)}/routes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routes: nextRoutes }),
    });
    if (els.routesMsg) els.routesMsg.textContent = `Routes applied to ${shortCode}.`;
    await loadRoutesForLink(shortCode);
  } catch (err) {
    if (els.routesMsg) els.routesMsg.textContent = err.message || 'Failed to apply routes.';
  }
}

function setLinkMode(mode) {
  linkMode = mode;
  if (els.existingWrap) els.existingWrap.style.display = mode === 'existing' ? '' : 'none';
  if (els.createWrap) els.createWrap.style.display = mode === 'new' ? '' : 'none';
  if (els.linkSelect) els.linkSelect.disabled = mode !== 'existing';
  if (els.linkFilter) els.linkFilter.disabled = mode !== 'existing';
}

async function checkAvailability() {
  const code = (els.shortCode?.value || '').trim();
  updateCodePreview();
  if (!code) return;
  if (availabilityTimer) clearTimeout(availabilityTimer);
  availabilityTimer = setTimeout(async () => {
    setCodeStatus('pending', 'Checking availability...');
    try {
      const res = await api(`/api/links/availability/${encodeURIComponent(code)}`);
      const result = res?.data || {};
      if (result.available) {
        setCodeStatus('ok', `${code} is available.`);
      } else {
        setCodeStatus('bad', result.reason || 'Code unavailable.');
      }
    } catch (err) {
      setCodeStatus('bad', 'Availability check failed.');
    }
  }, 350);
}

els.linkFilter?.addEventListener('input', () => {
  renderLinkOptions(filterLinks(els.linkFilter.value || ''));
});
els.linkSelect?.addEventListener('change', async () => {
  const link = links.find((item) => item.short_code === els.linkSelect.value);
  setLinkDetails(link);
  await loadRoutesForLink(els.linkSelect.value);
});
els.refreshLinks?.addEventListener('click', loadLinks);
els.refreshRoutes?.addEventListener('click', () => loadRoutesForLink(els.linkSelect?.value));
els.applyRoutes?.addEventListener('click', applyRoutes);
els.createLink?.addEventListener('click', createLink);
els.asin?.addEventListener('input', updatePreview);
els.destination?.addEventListener('change', updatePreview);
els.previewMarket?.addEventListener('change', updatePreview);
els.shortCode?.addEventListener('input', checkAvailability);
els.domainSelect?.addEventListener('change', updateCodePreview);
els.linkModeInputs.forEach((input) => {
  input.addEventListener('change', () => setLinkMode(input.value));
});
Array.from(document.querySelectorAll('.amazon-market')).forEach((input) => {
  input.addEventListener('change', updatePreview);
});

initPreviewMarkets();
updatePreview();
const initialMode = els.linkModeInputs.find((input) => input.checked)?.value || 'existing';
setLinkMode(initialMode);
loadContext();
loadLinks();

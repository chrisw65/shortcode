import { requireAuth, api, showToast } from '/admin/admin-common.js?v=20260120';

requireAuth();

const els = {
  linkFilter: document.getElementById('linkFilter'),
  linkSelect: document.getElementById('amazonLinkSelect'),
  linkDetails: document.getElementById('linkDetails'),
  refreshLinks: document.getElementById('refreshLinks'),
  refreshRoutes: document.getElementById('refreshRoutes'),
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

function normalizeAsin(value) {
  return String(value || '').trim().toUpperCase();
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

async function applyRoutes() {
  const shortCode = els.linkSelect?.value;
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
els.asin?.addEventListener('input', updatePreview);
els.destination?.addEventListener('change', updatePreview);
els.previewMarket?.addEventListener('change', updatePreview);
Array.from(document.querySelectorAll('.amazon-market')).forEach((input) => {
  input.addEventListener('change', updatePreview);
});

initPreviewMarkets();
updatePreview();
loadLinks();

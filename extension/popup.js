const ext = typeof browser === 'undefined' ? chrome : browser;

const currentUrl = document.getElementById('currentUrl');
const customCode = document.getElementById('customCode');
const shortenBtn = document.getElementById('shortenBtn');
const copyBtn = document.getElementById('copyBtn');
const status = document.getElementById('status');
const output = document.getElementById('output');
const settingsLink = document.getElementById('settingsLink');

let lastShortUrl = '';

function setStatus(message, isError) {
  status.textContent = message;
  status.classList.toggle('error', Boolean(isError));
}

function setOutput(url) {
  if (!url) {
    output.hidden = true;
    output.textContent = '';
    return;
  }
  output.hidden = false;
  output.textContent = url;
}

async function loadActiveTab() {
  const tabs = await ext.tabs.query({ active: true, currentWindow: true });
  const tab = tabs && tabs[0];
  const url = tab && tab.url ? tab.url : '';
  currentUrl.value = url;
}

async function getSettings() {
  const defaults = { apiBaseUrl: 'https://okleaf.link', apiKey: '' };
  return new Promise((resolve) => {
    ext.storage.sync.get(defaults, (items) => resolve(items));
  });
}

async function shortenUrl() {
  setStatus('', false);
  setOutput('');
  copyBtn.disabled = true;
  lastShortUrl = '';

  const url = String(currentUrl.value || '').trim();
  if (!url) {
    setStatus('No URL detected in the active tab.', true);
    return;
  }

  const settings = await getSettings();
  const apiKey = String(settings.apiKey || '').trim();
  const apiBaseUrl = String(settings.apiBaseUrl || '').trim().replace(/\/+$/, '');
  if (!apiKey) {
    setStatus('Set your API key in Settings first.', true);
    return;
  }
  if (!apiBaseUrl) {
    setStatus('API base URL is missing in Settings.', true);
    return;
  }

  const payload = { url };
  const code = String(customCode.value || '').trim();
  if (code) payload.short_code = code;

  shortenBtn.disabled = true;
  setStatus('Creating short link...');

  try {
    const res = await fetch(`${apiBaseUrl}/api/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const message = data && data.error ? data.error : `Request failed (${res.status})`;
      setStatus(message, true);
      return;
    }

    const shortUrl = data.data && data.data.short_url ? data.data.short_url : '';
    if (!shortUrl) {
      setStatus('Short URL missing in response.', true);
      return;
    }

    lastShortUrl = shortUrl;
    setOutput(shortUrl);
    copyBtn.disabled = false;
    setStatus('Short link created.');
  } catch (err) {
    setStatus(`Request failed: ${String(err)}`, true);
  } finally {
    shortenBtn.disabled = false;
  }
}

async function copyShortUrl() {
  if (!lastShortUrl) return;
  try {
    await navigator.clipboard.writeText(lastShortUrl);
    setStatus('Copied to clipboard.');
  } catch (err) {
    setStatus(`Copy failed: ${String(err)}`, true);
  }
}

settingsLink.addEventListener('click', (event) => {
  event.preventDefault();
  ext.runtime.openOptionsPage();
});

shortenBtn.addEventListener('click', () => void shortenUrl());
copyBtn.addEventListener('click', () => void copyShortUrl());

void loadActiveTab();

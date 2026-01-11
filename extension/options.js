const ext = typeof browser === 'undefined' ? chrome : browser;

const apiBaseUrl = document.getElementById('apiBaseUrl');
const apiKey = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const status = document.getElementById('status');

function setStatus(message, isError) {
  status.textContent = message;
  status.classList.toggle('error', Boolean(isError));
}

function loadSettings() {
  ext.storage.sync.get({ apiBaseUrl: 'https://okleaf.link', apiKey: '' }, (items) => {
    apiBaseUrl.value = items.apiBaseUrl || '';
    apiKey.value = items.apiKey || '';
  });
}

function saveSettings() {
  const base = String(apiBaseUrl.value || '').trim().replace(/\/+$/, '');
  const key = String(apiKey.value || '').trim();
  if (!base) {
    setStatus('API base URL is required.', true);
    return;
  }
  if (!key) {
    setStatus('API key is required.', true);
    return;
  }
  ext.storage.sync.set({ apiBaseUrl: base, apiKey: key }, () => {
    setStatus('Saved.');
  });
}

function clearSettings() {
  ext.storage.sync.set({ apiBaseUrl: 'https://okleaf.link', apiKey: '' }, () => {
    apiBaseUrl.value = 'https://okleaf.link';
    apiKey.value = '';
    setStatus('Cleared.');
  });
}

saveBtn.addEventListener('click', saveSettings);
clearBtn.addEventListener('click', clearSettings);

loadSettings();

const ext = typeof browser === 'undefined' ? chrome : browser;

const configPreset = document.getElementById('configPreset');
const customBaseWrap = document.getElementById('customBaseWrap');
const customBaseUrl = document.getElementById('customBaseUrl');
const apiKey = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const status = document.getElementById('status');

function setStatus(message, isError) {
  status.textContent = message;
  status.classList.toggle('error', Boolean(isError));
}

function resolvePreset(baseUrl) {
  if (baseUrl === 'https://okleaf.link') return 'prod';
  if (baseUrl.includes('staging')) return 'staging';
  return 'custom';
}

function syncPresetUI() {
  const preset = configPreset.value;
  const showCustom = preset === 'custom';
  customBaseWrap.style.display = showCustom ? 'block' : 'none';
  if (preset === 'prod') customBaseUrl.value = 'https://okleaf.link';
  if (preset === 'staging') customBaseUrl.value = 'https://staging.okleaf.link';
}

function loadSettings() {
  ext.storage.sync.get({ apiBaseUrl: 'https://okleaf.link', apiKey: '', preset: 'prod' }, (items) => {
    const baseUrl = items.apiBaseUrl || 'https://okleaf.link';
    const preset = items.preset || resolvePreset(baseUrl);
    configPreset.value = preset;
    customBaseUrl.value = baseUrl;
    apiKey.value = items.apiKey || '';
    syncPresetUI();
  });
}

function saveSettings() {
  const base = String(customBaseUrl.value || '').trim().replace(/\/+$/, '');
  const key = String(apiKey.value || '').trim();
  if (!base) {
    setStatus('API base URL is required.', true);
    return;
  }
  if (!key) {
    setStatus('API key is required.', true);
    return;
  }
  ext.storage.sync.set({ apiBaseUrl: base, apiKey: key, preset: configPreset.value }, () => {
    setStatus('Saved.');
  });
}

function clearSettings() {
  ext.storage.sync.set({ apiBaseUrl: 'https://okleaf.link', apiKey: '', preset: 'prod' }, () => {
    configPreset.value = 'prod';
    customBaseUrl.value = 'https://okleaf.link';
    apiKey.value = '';
    syncPresetUI();
    setStatus('Cleared.');
  });
}

saveBtn.addEventListener('click', saveSettings);
clearBtn.addEventListener('click', clearSettings);
configPreset.addEventListener('change', syncPresetUI);

loadSettings();

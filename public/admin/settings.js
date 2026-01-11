import { requireAuth, api, getActiveOrgId, setActiveOrgId, logoutAndRedirect } from '/admin/admin-common.js?v=20260120';

requireAuth();

const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

function activateSettingsTab(tabName = 'account') {
  tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  tabPanels.forEach((panel) => {
    panel.style.display = panel.dataset.panel === tabName ? 'block' : 'none';
  });
}
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => activateSettingsTab(btn.dataset.tab || 'account'));
});
activateSettingsTab('account');

const meEmail = document.getElementById('meEmail');
const meRole = document.getElementById('meRole');
const meOrg = document.getElementById('meOrg');
const meSuper = document.getElementById('meSuper');
const meEmailVerified = document.getElementById('meEmailVerified');
const resendVerifyBtn = document.getElementById('resendVerifyBtn');
const verifyMsg = document.getElementById('verifyMsg');
const orgSelect = document.getElementById('orgSelect');
const orgName = document.getElementById('orgName');
const orgRole = document.getElementById('orgRole');
const orgIpAnon = document.getElementById('orgIpAnon');
const orgRetention = document.getElementById('orgRetention');
const orgApiRpm = document.getElementById('orgApiRpm');
const orgLinkLimit = document.getElementById('orgLinkLimit');
const orgDomainLimit = document.getElementById('orgDomainLimit');
const orgRequireSso = document.getElementById('orgRequireSso');
const orgSaveBtn = document.getElementById('orgSaveBtn');
const orgMsg = document.getElementById('orgMsg');
const btnChange = document.getElementById('btnChange');
const curPass = document.getElementById('curPass');
const newPass = document.getElementById('newPass');
const msg = document.getElementById('msg');
const ssoProvider = document.getElementById('ssoProvider');
const ssoScopes = document.getElementById('ssoScopes');
const ssoIssuer = document.getElementById('ssoIssuer');
const ssoClientId = document.getElementById('ssoClientId');
const ssoClientSecret = document.getElementById('ssoClientSecret');
const ssoEnabled = document.getElementById('ssoEnabled');
const ssoAutoProvision = document.getElementById('ssoAutoProvision');
const ssoDefaultRole = document.getElementById('ssoDefaultRole');
const ssoAllowedDomains = document.getElementById('ssoAllowedDomains');
const ssoSaveBtn = document.getElementById('ssoSaveBtn');
const ssoMsg = document.getElementById('ssoMsg');
const twofaSetupBtn = document.getElementById('twofaSetupBtn');
const twofaDisableBtn = document.getElementById('twofaDisableBtn');
const twofaStatus = document.getElementById('twofaStatus');
const twofaSetupBlock = document.getElementById('twofaSetupBlock');
const twofaQr = document.getElementById('twofaQr');
const twofaSecret = document.getElementById('twofaSecret');
const twofaCode = document.getElementById('twofaCode');
const twofaVerifyBtn = document.getElementById('twofaVerifyBtn');
const twofaMsg = document.getElementById('twofaMsg');
const privacyExportBtn = document.getElementById('privacyExportBtn');
const privacyDeleteBtn = document.getElementById('privacyDeleteBtn');
const privacyAcceptBtn = document.getElementById('privacyAcceptBtn');
const privacyMsg = document.getElementById('privacyMsg');

let twoFactorEnabled = false;

function setText(el, value) {
  if (el) el.textContent = value ?? '—';
}

function updateTwoFactorUI() {
  if (twofaStatus) {
    twofaStatus.textContent = twoFactorEnabled ? 'Enabled' : 'Not enabled';
  }
  if (twofaDisableBtn) {
    twofaDisableBtn.disabled = !twoFactorEnabled;
  }
  if (twofaSetupBlock) {
    const active = twofaSetupBlock.dataset.active === '1';
    twofaSetupBlock.style.display = twoFactorEnabled ? 'none' : (active ? 'block' : 'none');
  }
}

async function loadMe() {
  try {
    const res = await api('/api/auth/me');
    const data = res?.data || res;
    setText(meEmail, data?.user?.email || '—');
    setText(meRole, data?.org?.role || 'member');
    setText(meOrg, data?.org?.orgId || '—');
    setText(meSuper, data?.user?.is_superadmin ? 'yes' : 'no');
    if (meEmailVerified) {
      const verified = data?.user?.email_verified !== false;
      meEmailVerified.textContent = verified ? 'Verified' : 'Not verified';
      if (resendVerifyBtn) resendVerifyBtn.disabled = verified;
      if (verifyMsg) verifyMsg.textContent = verified ? '' : 'Check your inbox for a verification email.';
    }
    twoFactorEnabled = Boolean(data?.user?.two_factor_enabled);
    updateTwoFactorUI();
  } catch (e) {
    setText(meEmail, '—');
    if (meEmailVerified) meEmailVerified.textContent = '—';
  }
}

async function loadOrgSettings() {
  try {
    const res = await api('/api/orgs');
    const data = res?.data || [];
    if (orgSelect) {
      if (!data.length) {
        orgSelect.innerHTML = '<option value="">No orgs found</option>';
        orgSelect.disabled = true;
      } else {
        orgSelect.disabled = false;
        orgSelect.innerHTML = data.map((org) => (
          `<option value="${org.id}">${org.name || org.id}</option>`
        )).join('');
        const current = getActiveOrgId() || data[0]?.id || '';
        if (current) {
          setActiveOrgId(current);
          orgSelect.value = current;
        }
      }
    }
    const orgRes = await api('/api/org');
    const orgData = orgRes?.data || orgRes;
    if (orgName) orgName.value = orgData?.name || '';
    if (orgRole) orgRole.value = data.find((o) => o.id === (getActiveOrgId() || orgData?.id))?.role || '';
    if (orgIpAnon) orgIpAnon.checked = Boolean(orgData?.ip_anonymization);
    if (orgRetention) orgRetention.value = orgData?.data_retention_days ? String(orgData.data_retention_days) : '';
    if (orgApiRpm) orgApiRpm.value = orgData?.api_rate_limit_rpm ? String(orgData.api_rate_limit_rpm) : '';
    if (orgLinkLimit) orgLinkLimit.value = orgData?.link_limit ? String(orgData.link_limit) : '';
    if (orgDomainLimit) orgDomainLimit.value = orgData?.domain_limit ? String(orgData.domain_limit) : '';
    if (meOrg && orgData?.name) meOrg.textContent = orgData.name;
  } catch (e) {
    if (orgMsg) orgMsg.textContent = e?.message || 'Failed to load orgs.';
  }
}

async function loadOrgPolicy() {
  try {
    const res = await api('/api/org/policy');
    const data = res?.data || res;
    if (orgRequireSso) orgRequireSso.checked = Boolean(data?.require_sso);
  } catch (e) {
    if (orgMsg) orgMsg.textContent = e?.message || 'Failed to load org policy.';
  }
}

async function loadSsoSettings() {
  try {
    const res = await api('/api/org/sso');
    const data = res?.data || res;
    if (ssoProvider) ssoProvider.value = data?.provider || 'oidc';
    if (ssoScopes) ssoScopes.value = Array.isArray(data?.scopes) ? data.scopes.join(',') : '';
    if (ssoIssuer) ssoIssuer.value = data?.issuer_url || '';
    if (ssoClientId) ssoClientId.value = data?.client_id || '';
    if (ssoEnabled) ssoEnabled.checked = Boolean(data?.enabled);
    if (ssoAutoProvision) ssoAutoProvision.checked = data?.auto_provision !== false;
    if (ssoDefaultRole) ssoDefaultRole.value = data?.default_role || 'member';
    if (ssoAllowedDomains) ssoAllowedDomains.value = Array.isArray(data?.allowed_domains) ? data.allowed_domains.join(', ') : '';
  } catch (e) {
    if (ssoMsg) ssoMsg.textContent = e?.message || 'Failed to load SSO settings.';
  }
}

async function saveSsoSettings() {
  if (ssoSaveBtn) ssoSaveBtn.disabled = true;
  if (ssoMsg) ssoMsg.textContent = '';
  try {
    const provider = ssoProvider ? ssoProvider.value : 'oidc';
    const scopes = ssoScopes ? ssoScopes.value.split(',').map(s => s.trim()).filter(Boolean) : [];
    await api('/api/org/sso', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        scopes,
        issuer_url: ssoIssuer ? ssoIssuer.value.trim() : '',
        client_id: ssoClientId ? ssoClientId.value.trim() : '',
        client_secret: ssoClientSecret ? ssoClientSecret.value.trim() : '',
        enabled: ssoEnabled ? ssoEnabled.checked : false,
        auto_provision: ssoAutoProvision ? ssoAutoProvision.checked : true,
        default_role: ssoDefaultRole ? ssoDefaultRole.value : 'member',
        allowed_domains: ssoAllowedDomains ? ssoAllowedDomains.value.split(',').map(s => s.trim()).filter(Boolean) : [],
      }),
    });
    if (ssoMsg) ssoMsg.textContent = 'SSO settings saved.';
    if (ssoClientSecret) ssoClientSecret.value = '';
  } catch (e) {
    if (ssoMsg) ssoMsg.textContent = e?.message || 'Failed to save SSO settings.';
  } finally {
    if (ssoSaveBtn) ssoSaveBtn.disabled = false;
  }
}

async function saveOrgSettings() {
  if (!orgName) return;
  const name = orgName.value.trim();
  if (!name) {
    if (orgMsg) orgMsg.textContent = 'Organization name is required.';
    return;
  }
  if (orgSaveBtn) orgSaveBtn.disabled = true;
  if (orgMsg) orgMsg.textContent = '';
  try {
    const retentionRaw = orgRetention ? orgRetention.value.trim() : '';
    const retentionValue = retentionRaw ? Number(retentionRaw) : null;
    if (retentionRaw && (!Number.isInteger(retentionValue) || retentionValue < 1 || retentionValue > 3650)) {
      if (orgMsg) orgMsg.textContent = 'Retention must be 1-3650 days.';
      if (orgSaveBtn) orgSaveBtn.disabled = false;
      return;
    }
    const apiRaw = orgApiRpm ? orgApiRpm.value.trim() : '';
    const apiValue = apiRaw ? Number(apiRaw) : null;
    if (apiRaw && (!Number.isInteger(apiValue) || apiValue < 30 || apiValue > 100000)) {
      if (orgMsg) orgMsg.textContent = 'API rate limit must be 30-100000 rpm.';
      if (orgSaveBtn) orgSaveBtn.disabled = false;
      return;
    }
    const linkRaw = orgLinkLimit ? orgLinkLimit.value.trim() : '';
    const linkValue = linkRaw ? Number(linkRaw) : null;
    if (linkRaw && (!Number.isInteger(linkValue) || linkValue < 1 || linkValue > 1000000)) {
      if (orgMsg) orgMsg.textContent = 'Link limit must be 1-1000000.';
      if (orgSaveBtn) orgSaveBtn.disabled = false;
      return;
    }
    const domainRaw = orgDomainLimit ? orgDomainLimit.value.trim() : '';
    const domainValue = domainRaw ? Number(domainRaw) : null;
    if (domainRaw && (!Number.isInteger(domainValue) || domainValue < 1 || domainValue > 100000)) {
      if (orgMsg) orgMsg.textContent = 'Domain limit must be 1-100000.';
      if (orgSaveBtn) orgSaveBtn.disabled = false;
      return;
    }
    await api('/api/org', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        ip_anonymization: orgIpAnon ? orgIpAnon.checked : undefined,
        data_retention_days: retentionRaw ? retentionValue : null,
        api_rate_limit_rpm: apiRaw ? apiValue : null,
        link_limit: linkRaw ? linkValue : null,
        domain_limit: domainRaw ? domainValue : null,
      }),
    });
    await api('/api/org/policy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        require_sso: orgRequireSso ? orgRequireSso.checked : false,
      }),
    });
    if (orgMsg) orgMsg.textContent = 'Organization updated.';
  } catch (e) {
    if (orgMsg) orgMsg.textContent = e?.message || 'Failed to update org.';
  } finally {
    if (orgSaveBtn) orgSaveBtn.disabled = false;
  }
}

function onOrgSwitch() {
  if (!orgSelect) return;
  const selected = orgSelect.value;
  setActiveOrgId(selected);
  window.location.reload();
}

async function changePassword() {
  const current_password = (curPass.value || '').trim();
  const new_password = (newPass.value || '').trim();
  msg.textContent = '';

  if (!current_password || !new_password) {
    msg.textContent = 'Both fields are required.';
    return;
  }
  if (new_password.length < 8) {
    msg.textContent = 'New password must be at least 8 characters.';
    return;
  }

  btnChange.disabled = true;
  try {
    await api('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password, new_password })
    });
    msg.textContent = 'Password updated.';
    curPass.value = '';
    newPass.value = '';
  } catch (e) {
    msg.textContent = e?.message || 'Failed to update password.';
  } finally {
    btnChange.disabled = false;
  }
}

async function setupTwoFactor() {
  if (twofaMsg) twofaMsg.textContent = '';
  try {
    const res = await api('/api/auth/2fa/setup', { method: 'POST' });
    const data = res?.data || res;
    if (twofaQr) twofaQr.src = data?.qr_data_url || '';
    if (twofaSecret) twofaSecret.textContent = data?.secret || '—';
    if (twofaSetupBlock) twofaSetupBlock.dataset.active = '1';
    if (twofaSetupBlock) twofaSetupBlock.style.display = 'block';
    if (twofaMsg) twofaMsg.textContent = 'Scan the QR code in your authenticator app.';
  } catch (e) {
    if (twofaMsg) twofaMsg.textContent = e?.message || 'Failed to start 2FA setup.';
  }
}

async function verifyTwoFactor() {
  const code = String(twofaCode?.value || '').trim();
  if (!code) {
    if (twofaMsg) twofaMsg.textContent = 'Enter the verification code.';
    return;
  }
  if (twofaMsg) twofaMsg.textContent = '';
  try {
    await api('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    twoFactorEnabled = true;
    updateTwoFactorUI();
    if (twofaMsg) twofaMsg.textContent = 'Two-factor authentication enabled.';
  } catch (e) {
    if (twofaMsg) twofaMsg.textContent = e?.message || 'Failed to verify code.';
  }
}

async function disableTwoFactor() {
  const password = window.prompt('Enter your current password to disable 2FA.');
  if (!password) return;
  const code = window.prompt('Enter your current 2FA code.');
  if (!code) return;
  if (twofaMsg) twofaMsg.textContent = '';
  try {
    await api('/api/auth/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: password, code }),
    });
    twoFactorEnabled = false;
    if (twofaQr) twofaQr.src = '';
    if (twofaSecret) twofaSecret.textContent = '—';
    if (twofaCode) twofaCode.value = '';
    if (twofaSetupBlock) twofaSetupBlock.dataset.active = '0';
    updateTwoFactorUI();
    if (twofaMsg) twofaMsg.textContent = 'Two-factor authentication disabled.';
  } catch (e) {
    if (twofaMsg) twofaMsg.textContent = e?.message || 'Failed to disable 2FA.';
  }
}

async function resendVerification() {
  const email = (meEmail?.textContent || '').trim();
  if (!email || email === '—') {
    if (verifyMsg) verifyMsg.textContent = 'Email not available.';
    return;
  }
  if (verifyMsg) verifyMsg.textContent = 'Sending verification email…';
  if (resendVerifyBtn) resendVerifyBtn.disabled = true;
  try {
    await api('/api/auth/verify-email/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (verifyMsg) verifyMsg.textContent = 'Verification email sent.';
  } catch (e) {
    if (verifyMsg) verifyMsg.textContent = e?.message || 'Failed to send verification email.';
  } finally {
    if (resendVerifyBtn) resendVerifyBtn.disabled = false;
  }
}

btnChange?.addEventListener('click', changePassword);
resendVerifyBtn?.addEventListener('click', resendVerification);
orgSaveBtn?.addEventListener('click', saveOrgSettings);
orgSelect?.addEventListener('change', onOrgSwitch);
ssoSaveBtn?.addEventListener('click', saveSsoSettings);
twofaSetupBtn?.addEventListener('click', setupTwoFactor);
twofaVerifyBtn?.addEventListener('click', verifyTwoFactor);
twofaDisableBtn?.addEventListener('click', disableTwoFactor);
privacyExportBtn?.addEventListener('click', () => {
  window.location.href = '/api/privacy/export';
});
privacyAcceptBtn?.addEventListener('click', async () => {
  if (privacyMsg) privacyMsg.textContent = '';
  try {
    await api('/api/privacy/accept-terms', { method: 'POST' });
    if (privacyMsg) privacyMsg.textContent = 'Terms accepted.';
  } catch (e) {
    if (privacyMsg) privacyMsg.textContent = e?.message || 'Failed to accept terms.';
  }
});
privacyDeleteBtn?.addEventListener('click', async () => {
  if (!window.confirm('Delete your account? This cannot be undone.')) return;
  if (privacyMsg) privacyMsg.textContent = '';
  try {
    await api('/api/privacy/delete', { method: 'POST' });
    logoutAndRedirect();
  } catch (e) {
    if (privacyMsg) privacyMsg.textContent = e?.message || 'Failed to delete account.';
  }
});
loadMe();
loadOrgSettings();
loadOrgPolicy();
loadSsoSettings();

// src/services/inviteEmails.ts
import { sendMail } from './mailer';
import { getPublishedSiteConfig } from './siteConfig';

const APP_URL = process.env.PUBLIC_HOST || process.env.BASE_URL || 'https://okleaf.link';

export async function sendInviteEmail(params: { to: string; inviter?: string | null; token: string }) {
  const inviteUrl = `${APP_URL}/register.html?invite=${encodeURIComponent(params.token)}`;
  const config = await getPublishedSiteConfig();
  const brandName = config?.brand?.name || 'OkLeaf';
  const supportEmail = config?.footer?.email || 'support@okleaf.link';
  const inviter = params.inviter || 'A teammate';
  const vars = { brandName, supportEmail, inviter, inviteUrl };

  const tmpl = config?.emails?.invite || {};
  const subject = renderTemplate(tmpl.subject || 'You are invited to {{brandName}}', vars);
  const text = renderTemplate(
    tmpl.text || `${inviter} invited you to join ${brandName}.\n\nJoin here: ${inviteUrl}`,
    vars
  );
  const html = renderTemplate(
    tmpl.html || [
      '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">',
      `<h2>You are invited to ${brandName}</h2>`,
      `<p>${inviter} invited you to join ${brandName}.</p>`,
      `<p><a href="${inviteUrl}">Accept your invite</a></p>`,
      `<p>If the button doesn't work, copy this link:<br>${inviteUrl}</p>`,
      `<p>Need help? Contact ${supportEmail}.</p>`,
      '</div>',
    ].join(''),
    vars
  );

  return sendMail({ to: params.to, subject, text, html });
}

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => (
    key in vars ? vars[key] : match
  ));
}

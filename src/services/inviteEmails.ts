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
      '<div style="background:#edf2f7;padding:32px 12px;font-family:Helvetica,Arial,sans-serif;color:#0f172a;">',
      '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 12px 30px rgba(15,23,42,0.08);">',
      '<tr>',
      `<td style="padding:28px 32px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#ffffff;">`,
      `<div style="font-size:20px;font-weight:700;letter-spacing:0.3px;">${brandName}</div>`,
      '<div style="opacity:0.8;font-size:13px;margin-top:6px;letter-spacing:0.2px;">Invitation to collaborate</div>',
      '</td>',
      '</tr>',
      '<tr>',
      '<td style="padding:32px;">',
      '<h2 style="margin:0 0 12px;font-size:22px;color:#0f172a;">You are invited</h2>',
      `<p style="margin:0 0 16px;line-height:1.7;color:#334155;">${inviter} invited you to join ${brandName}. Accept the invite to access your workspace, manage links, and view analytics.</p>`,
      '<div style="margin:22px 0;">',
      `<a href="${inviteUrl}" style="display:inline-block;padding:12px 22px;background:#2563eb;color:#ffffff;border-radius:999px;text-decoration:none;font-weight:600;">Accept invite</a>`,
      '</div>',
      '<div style="font-size:13px;color:#64748b;margin-top:12px;">If the button doesn\'t work, copy this link:</div>',
      `<div style="font-size:13px;color:#2563eb;word-break:break-all;">${inviteUrl}</div>`,
      '<div style="margin-top:18px;padding:12px 14px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;font-size:13px;color:#475569;">',
      'This invite is unique to you. If you were not expecting it, you can ignore this email.',
      '</div>',
      '</td>',
      '</tr>',
      '<tr>',
      `<td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">Need help? Contact ${supportEmail}.</td>`,
      '</tr>',
      '</table>',
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

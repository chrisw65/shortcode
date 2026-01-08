// src/services/inviteEmails.ts
import { sendMail } from './mailer';

const APP_URL = process.env.PUBLIC_HOST || process.env.BASE_URL || 'https://okleaf.link';

export async function sendInviteEmail(params: { to: string; inviter?: string | null; token: string }) {
  const inviteUrl = `${APP_URL}/register.html?invite=${encodeURIComponent(params.token)}`;
  const subject = 'You are invited to OkLeaf';
  const text = `${params.inviter || 'A teammate'} invited you to join OkLeaf.\n\nJoin here: ${inviteUrl}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
      <h2>You're invited to OkLeaf</h2>
      <p>${params.inviter || 'A teammate'} invited you to join OkLeaf.</p>
      <p><a href="${inviteUrl}">Accept your invite</a></p>
      <p>If the button doesn't work, copy this link:<br>${inviteUrl}</p>
    </div>
  `;

  return sendMail({ to: params.to, subject, text, html });
}

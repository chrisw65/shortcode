// src/services/mailer.ts
import nodemailer from 'nodemailer';
import { DEFAULT_SITE_CONFIG, getSiteSetting, mergeConfig } from './siteConfig';

export type MailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type MailSendOptions = {
  useDraft?: boolean;
};

type SmtpSettings = {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
};

async function resolveSmtpSettings(useDraft: boolean): Promise<SmtpSettings | null> {
  try {
    let stored = await getSiteSetting(useDraft ? 'marketing_draft' : 'marketing_published');
    if (!stored && !useDraft) {
      stored = await getSiteSetting('marketing_draft');
    }
    const merged = mergeConfig(DEFAULT_SITE_CONFIG, stored || {});
    return merged?.smtp || null;
  } catch {
    return null;
  }
}

function normalizeSmtpValue(value: unknown): string {
  return String(value || '').trim();
}

async function buildTransport(useDraft: boolean) {
  const smtp = await resolveSmtpSettings(useDraft);
  const host = normalizeSmtpValue(smtp?.host) || normalizeSmtpValue(process.env.SMTP_HOST);
  const port = Number(smtp?.port || process.env.SMTP_PORT || 587);
  const user = normalizeSmtpValue(smtp?.user) || normalizeSmtpValue(process.env.SMTP_USER);
  const pass = normalizeSmtpValue(smtp?.password) || normalizeSmtpValue(process.env.SMTP_PASSWORD);

  if (!host || !user || !pass) return null;

  return { smtp, transport: nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  }) };
}

export async function hasSmtpConfig(useDraft = false) {
  const smtp = await resolveSmtpSettings(useDraft);
  const host = normalizeSmtpValue(smtp?.host) || normalizeSmtpValue(process.env.SMTP_HOST);
  const user = normalizeSmtpValue(smtp?.user) || normalizeSmtpValue(process.env.SMTP_USER);
  const pass = normalizeSmtpValue(smtp?.password) || normalizeSmtpValue(process.env.SMTP_PASSWORD);
  return Boolean(host && user && pass);
}

export async function sendMail(opts: MailOptions, options: MailSendOptions = {}) {
  const built = await buildTransport(Boolean(options.useDraft));
  if (!built) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  const fromName = normalizeSmtpValue(built.smtp?.from_name);
  const fromEmail = normalizeSmtpValue(built.smtp?.from_email);
  const replyTo = normalizeSmtpValue(built.smtp?.reply_to);
  const from = fromEmail
    ? (fromName ? `${fromName} <${fromEmail}>` : fromEmail)
    : (process.env.SMTP_FROM || 'OkLeaf <no-reply@okleaf.link>');
  const payload = {
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  } as any;
  if (replyTo) payload.replyTo = replyTo;
  await built.transport.sendMail(payload);

  return { sent: true };
}

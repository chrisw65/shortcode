// src/services/mailer.ts
import nodemailer from 'nodemailer';

export type MailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function buildTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendMail(opts: MailOptions) {
  const transport = buildTransport();
  if (!transport) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  const from = process.env.SMTP_FROM || 'OkLeaf <no-reply@okleaf.link>';
  await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });

  return { sent: true };
}

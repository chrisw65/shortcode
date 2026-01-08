// scripts/send-invite-reminders.js
// Sends reminders for pending invites older than 3 days (best-effort).
require('dotenv').config();
const db = require('../dist/config/database').default || require('../dist/config/database');
const { sendInviteEmail } = require('../dist/services/inviteEmails');

const DAYS = Number(process.env.INVITE_REMIND_DAYS || 3);

async function run() {
  const { rows } = await db.query(
    `SELECT id, invitee_email, token
       FROM invites
      WHERE status = 'sent'
        AND created_at < NOW() - ($1 || ' days')::interval
        AND (last_reminded_at IS NULL OR last_reminded_at < NOW() - ($1 || ' days')::interval)
      LIMIT 100`,
    [DAYS]
  );

  for (const row of rows) {
    try {
      await sendInviteEmail({ to: row.invitee_email, token: row.token });
      await db.query(`UPDATE invites SET last_reminded_at = NOW() WHERE id = $1`, [row.id]);
      // eslint-disable-next-line no-console
      console.log('reminded', row.invitee_email);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('reminder failed', row.invitee_email, err?.message || err);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Done. Sent ${rows.length} reminders.`);
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('reminder job failed', err);
  process.exit(1);
});

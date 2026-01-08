// src/services/referrals.ts
import db from '../config/database';

const REFERRAL_PLAN = 'pro';
const REFERRAL_MONTHS = 1;

export async function tryGrantReferralReward(userId: string, orgId: string | null) {
  const { rows } = await db.query(
    `SELECT id, referrer_user_id
       FROM referrals
      WHERE invitee_user_id = $1
        AND reward_status = 'pending'
      LIMIT 1`,
    [userId]
  );
  const referral = rows[0];
  if (!referral || !referral.referrer_user_id) return;

  await db.query('BEGIN');
  try {
    const { rows: grantRows } = await db.query(
      `INSERT INTO plan_grants (target_type, target_id, plan, ends_at, reason, created_by)
       VALUES ('user', $1, $2, NOW() + ($3 || ' months')::interval, $4, $5)
       RETURNING id`,
      [referral.referrer_user_id, REFERRAL_PLAN, REFERRAL_MONTHS, 'referral:referrer', userId]
    );
    await db.query(
      `INSERT INTO plan_grants (target_type, target_id, plan, ends_at, reason, created_by)
       VALUES ('user', $1, $2, NOW() + ($3 || ' months')::interval, $4, $5)`,
      [userId, REFERRAL_PLAN, REFERRAL_MONTHS, 'referral:invitee', userId]
    );

    await db.query(
      `UPDATE referrals
          SET reward_status = 'granted',
              reward_grant_id = $1
        WHERE id = $2`,
      [grantRows[0]?.id || null, referral.id]
    );

    if (orgId) {
      await db.query(
        `UPDATE affiliate_conversions
            SET status = 'approved'
          WHERE user_id = $1 AND org_id = $2 AND status = 'pending'`,
        [userId, orgId]
      );
    }

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

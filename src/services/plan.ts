import db from '../config/database';

export async function getEffectivePlan(userId: string, orgId?: string | null): Promise<string> {
  const { rows } = await db.query<{ plan: string }>(
    `SELECT plan
       FROM plan_grants
      WHERE (
              (target_type = 'org' AND target_id = $1)
           OR (target_type = 'user' AND target_id = $2)
            )
        AND (ends_at IS NULL OR ends_at > NOW())
      ORDER BY ends_at DESC NULLS LAST, created_at DESC
      LIMIT 1`,
    [orgId ?? null, userId],
  );

  if (rows[0]?.plan) return rows[0].plan;

  const userPlan = await db.query<{ plan: string }>(
    `SELECT COALESCE(plan, 'free') AS plan
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [userId],
  );

  return userPlan.rows[0]?.plan || 'free';
}

export async function getOrgPlan(orgId: string): Promise<string> {
  const { rows } = await db.query<{ plan: string }>(
    `SELECT plan
       FROM plan_grants
      WHERE target_type = 'org'
        AND target_id = $1
        AND (ends_at IS NULL OR ends_at > NOW())
      ORDER BY ends_at DESC NULLS LAST, created_at DESC
      LIMIT 1`,
    [orgId],
  );
  if (rows[0]?.plan) return rows[0].plan;
  const fallback = await db.query<{ plan: string }>(
    `SELECT COALESCE(u.plan, 'free') AS plan
       FROM orgs o
       JOIN users u ON u.id = o.owner_user_id
      WHERE o.id = $1
      LIMIT 1`,
    [orgId],
  );
  return fallback.rows[0]?.plan || 'free';
}

export function isPaidPlan(plan: string): boolean {
  return Boolean(plan && plan.toLowerCase() !== 'free');
}

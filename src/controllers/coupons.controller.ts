// src/controllers/coupons.controller.ts
import type { Request, Response } from 'express';
import db from '../config/database';

function normalizeCode(code: string) {
  return code.replace(/\s+/g, '').toUpperCase();
}

export async function listCoupons(_req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      `SELECT id, code, plan, duration_months, percent_off, max_redemptions,
              expires_at, active, created_at
         FROM coupons
        ORDER BY created_at DESC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('coupons.listCoupons error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createCoupon(req: Request, res: Response) {
  try {
    const code = normalizeCode(String(req.body?.code || ''));
    const plan = String(req.body?.plan || '');
    const durationMonths = Number(req.body?.duration_months || 1);
    const percentOff = req.body?.percent_off ? Number(req.body.percent_off) : null;
    const maxRedemptions = req.body?.max_redemptions ? Number(req.body.max_redemptions) : null;
    const expiresAt = req.body?.expires_at ? new Date(req.body.expires_at) : null;

    if (!code || !plan) {
      return res.status(400).json({ success: false, error: 'code and plan are required' });
    }

    const { rows } = await db.query(
      `INSERT INTO coupons (code, plan, duration_months, percent_off, max_redemptions, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, code, plan, duration_months, percent_off, max_redemptions, expires_at, active, created_at`,
      [code, plan, durationMonths, percentOff, maxRedemptions, expiresAt]
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('coupons.createCoupon error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function redeemCoupon(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    const code = normalizeCode(String(req.body?.code || ''));
    if (!userId || !code) return res.status(400).json({ success: false, error: 'code is required' });

    const { rows } = await db.query(
      `SELECT *
         FROM coupons
        WHERE code = $1 AND active = true
        LIMIT 1`,
      [code]
    );
    const coupon = rows[0];
    if (!coupon) return res.status(404).json({ success: false, error: 'Invalid coupon' });
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: 'Coupon expired' });
    }

    const { rows: redemptions } = await db.query(
      `SELECT count(*)::int AS count FROM coupon_redemptions WHERE coupon_id = $1`,
      [coupon.id]
    );
    if (coupon.max_redemptions && redemptions[0]?.count >= coupon.max_redemptions) {
      return res.status(400).json({ success: false, error: 'Coupon limit reached' });
    }

    await db.query(
      `INSERT INTO coupon_redemptions (coupon_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [coupon.id, userId]
    );

    await db.query(
      `INSERT INTO plan_grants (target_type, target_id, plan, ends_at, reason, created_by)
       VALUES ('user', $1, $2, NOW() + ($3 || ' months')::interval, $4, $5)`,
      [userId, coupon.plan, coupon.duration_months, `coupon:${coupon.code}`, userId]
    );

    return res.json({ success: true, data: { redeemed: true, plan: coupon.plan, duration_months: coupon.duration_months } });
  } catch (err) {
    console.error('coupons.redeemCoupon error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

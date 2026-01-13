// src/controllers/affiliateAuth.controller.ts
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import db from '../config/database';
import type { AffiliateRequest } from '../middleware/auth';
import { getAffiliateConfig } from '../services/affiliateConfig';
import { log } from '../utils/logger';

function signAffiliateToken(payload: Record<string, any>) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing');
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export async function affiliateLogin(req: Request, res: Response) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const { rows } = await db.query(
      `SELECT id, email, name, status, password_hash
         FROM affiliates
        WHERE email = $1
        LIMIT 1`,
      [email]
    );
    const affiliate = rows[0];
    if (!affiliate || !affiliate.password_hash) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    if (affiliate.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Affiliate not active' });
    }

    const ok = await bcrypt.compare(password, affiliate.password_hash);
    if (!ok) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    await db.query(`UPDATE affiliates SET last_login_at = NOW() WHERE id = $1`, [affiliate.id]);

    const token = signAffiliateToken({ affiliateId: affiliate.id, type: 'affiliate' });
    return res.json({ success: true, data: { token, affiliate: { id: affiliate.id, name: affiliate.name, email: affiliate.email } } });
  } catch (err) {
    log('error', 'affiliate.login.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function affiliateMe(req: AffiliateRequest, res: Response) {
  try {
    const affiliateId = req.affiliate?.affiliateId;
    if (!affiliateId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { rows } = await db.query(
      `SELECT id, name, email, company, status, code, payout_type, payout_rate
         FROM affiliates
        WHERE id = $1`,
      [affiliateId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Affiliate not found' });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    log('error', 'affiliate.me.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function affiliateSummary(req: AffiliateRequest, res: Response) {
  try {
    const affiliateId = req.affiliate?.affiliateId;
    if (!affiliateId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { rows } = await db.query(
      `SELECT
         COUNT(*)::int AS conversions,
         COALESCE(SUM(net_amount), 0)::numeric AS total_amount,
         COALESCE(SUM(payout_amount), 0)::numeric AS total_payout,
         COALESCE(SUM(points), 0)::int AS total_points,
         COALESCE(SUM(points) FILTER (WHERE points_expires_at IS NULL OR points_expires_at > NOW()), 0)::int AS active_points
       FROM affiliate_conversions
       WHERE affiliate_id = $1`,
      [affiliateId]
    );

    const { rows: pending } = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS pending_amount
         FROM affiliate_payouts
        WHERE affiliate_id = $1 AND status = 'pending'`,
      [affiliateId]
    );

    return res.json({
      success: true,
      data: {
        conversions: rows[0]?.conversions || 0,
        total_amount: rows[0]?.total_amount || 0,
        total_payout: rows[0]?.total_payout || 0,
        pending_amount: pending[0]?.pending_amount || 0,
        total_points: rows[0]?.total_points || 0,
        active_points: rows[0]?.active_points || 0,
      },
    });
  } catch (err) {
    log('error', 'affiliate.summary.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function affiliateConversions(req: AffiliateRequest, res: Response) {
  try {
    const affiliateId = req.affiliate?.affiliateId;
    if (!affiliateId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { rows } = await db.query(
      `SELECT id, user_id, org_id, amount, event_type, plan_id, currency, gross_amount, discount_amount, net_amount,
              payout_amount, payout_rate, coupon_code, affiliate_coupon, points, points_expires_at, status, created_at
         FROM affiliate_conversions
        WHERE affiliate_id = $1
        ORDER BY created_at DESC
        LIMIT 200`,
      [affiliateId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'affiliate.conversions.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function affiliatePayouts(req: AffiliateRequest, res: Response) {
  try {
    const affiliateId = req.affiliate?.affiliateId;
    if (!affiliateId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { rows } = await db.query(
      `SELECT id, period_start, period_end, amount, status, created_at, paid_at
         FROM affiliate_payouts
        WHERE affiliate_id = $1
        ORDER BY created_at DESC
        LIMIT 24`,
      [affiliateId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'affiliate.payouts.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function affiliateConfig(req: AffiliateRequest, res: Response) {
  try {
    if (!req.affiliate?.affiliateId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const config = await getAffiliateConfig();
    return res.json({ success: true, data: config });
  } catch (err) {
    log('error', 'affiliate.config.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function affiliateCoupons(req: AffiliateRequest, res: Response) {
  try {
    const affiliateId = req.affiliate?.affiliateId;
    if (!affiliateId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { rows } = await db.query(
      `SELECT id, code, plan, duration_months, percent_off, max_redemptions, expires_at, active, created_at
         FROM coupons
        WHERE affiliate_id = $1
        ORDER BY created_at DESC
        LIMIT 200`,
      [affiliateId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'affiliate.coupons.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createAffiliateCoupon(req: AffiliateRequest, res: Response) {
  try {
    const affiliateId = req.affiliate?.affiliateId;
    if (!affiliateId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const config = await getAffiliateConfig();
    if (!config.allow_affiliate_coupons) {
      return res.status(403).json({ success: false, error: 'Affiliate coupons are disabled' });
    }

    const plan = String(req.body?.plan || '').trim();
    const percentOff = Number(req.body?.percent_off || 0);
    const durationMonths = Number(req.body?.duration_months || config.coupon_max_duration_months || 1);
    const maxRedemptions = Number(req.body?.max_redemptions || config.coupon_default_max_redemptions || 0) || null;
    const codeInput = String(req.body?.code || '').trim().toUpperCase();
    const code = codeInput || `AFF-${randomBytes(3).toString('hex').toUpperCase()}`;

    if (!plan) return res.status(400).json({ success: false, error: 'plan is required' });
    if (!percentOff || percentOff < 1 || percentOff > config.coupon_max_percent_off) {
      return res.status(400).json({ success: false, error: 'Invalid percent_off' });
    }
    if (!durationMonths || durationMonths < 1 || durationMonths > config.coupon_max_duration_months) {
      return res.status(400).json({ success: false, error: 'Invalid duration_months' });
    }

    const { rows } = await db.query(
      `INSERT INTO coupons (code, plan, duration_months, percent_off, max_redemptions, affiliate_id, affiliate_funded)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, code, plan, duration_months, percent_off, max_redemptions, active, created_at`,
      [code, plan, durationMonths, percentOff, maxRedemptions, affiliateId]
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    log('error', 'affiliate.createCoupon.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

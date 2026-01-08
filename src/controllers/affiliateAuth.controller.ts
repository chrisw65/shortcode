// src/controllers/affiliateAuth.controller.ts
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../config/database';

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
    console.error('affiliateLogin error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function affiliateMe(req: Request, res: Response) {
  try {
    const affiliateId = (req as any).affiliate?.affiliateId;
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
    console.error('affiliateMe error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function affiliateSummary(req: Request, res: Response) {
  try {
    const affiliateId = (req as any).affiliate?.affiliateId;
    if (!affiliateId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { rows } = await db.query(
      `SELECT
         COUNT(*)::int AS conversions,
         COALESCE(SUM(amount), 0)::numeric AS total_amount
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
        pending_amount: pending[0]?.pending_amount || 0,
      },
    });
  } catch (err) {
    console.error('affiliateSummary error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function affiliateConversions(req: Request, res: Response) {
  try {
    const affiliateId = (req as any).affiliate?.affiliateId;
    if (!affiliateId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { rows } = await db.query(
      `SELECT id, amount, status, created_at
         FROM affiliate_conversions
        WHERE affiliate_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [affiliateId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('affiliateConversions error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function affiliatePayouts(req: Request, res: Response) {
  try {
    const affiliateId = (req as any).affiliate?.affiliateId;
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
    console.error('affiliatePayouts error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

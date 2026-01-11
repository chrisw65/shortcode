// src/controllers/affiliates.controller.ts
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import db from '../config/database';
import { log } from '../utils/logger';

function makeCode() {
  return randomBytes(4).toString('hex').toUpperCase();
}

export async function listAffiliates(_req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, company, status, code, payout_type, payout_rate, created_at
         FROM affiliates
        ORDER BY created_at DESC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'affiliates.listAffiliates error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createAffiliate(req: Request, res: Response) {
  try {
    const name = String(req.body?.name || '');
    const email = String(req.body?.email || '').trim().toLowerCase();
    const company = req.body?.company ? String(req.body.company) : null;
    const payoutType = String(req.body?.payout_type || 'percent');
    const payoutRate = Number(req.body?.payout_rate || 30);

    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'name and email are required' });
    }
    if (!['percent', 'flat'].includes(payoutType)) {
      return res.status(400).json({ success: false, error: 'Invalid payout_type' });
    }

    const code = makeCode();
    const tempPassword = randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const { rows } = await db.query(
      `INSERT INTO affiliates (name, email, company, status, code, payout_type, payout_rate, password_hash)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
       RETURNING id, name, email, company, status, code, payout_type, payout_rate, created_at`,
      [name, email, company, code, payoutType, payoutRate, passwordHash]
    );

    return res.status(201).json({ success: true, data: { ...rows[0], temp_password: tempPassword } });
  } catch (err) {
    log('error', 'affiliates.createAffiliate error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateAffiliate(req: Request, res: Response) {
  try {
    const id = String(req.params?.id || '');
    const status = req.body?.status ? String(req.body.status) : null;
    if (!id || !status || !['pending', 'active', 'paused'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid update' });
    }

    await db.query(`UPDATE affiliates SET status = $1 WHERE id = $2`, [status, id]);
    return res.json({ success: true, data: { updated: true } });
  } catch (err) {
    log('error', 'affiliates.updateAffiliate error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function listAffiliatePayouts(_req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      `SELECT p.id, p.affiliate_id, p.period_start, p.period_end, p.amount, p.status, p.created_at, p.paid_at,
              a.name AS affiliate_name
         FROM affiliate_payouts p
         LEFT JOIN affiliates a ON a.id = p.affiliate_id
        ORDER BY p.created_at DESC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'affiliates.listAffiliatePayouts error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createAffiliatePayout(req: Request, res: Response) {
  try {
    const affiliateId = String(req.body?.affiliate_id || '');
    const periodStart = String(req.body?.period_start || '');
    const periodEnd = String(req.body?.period_end || '');
    const amount = Number(req.body?.amount || 0);
    if (!affiliateId || !periodStart || !periodEnd || !amount) {
      return res.status(400).json({ success: false, error: 'Invalid payout' });
    }

    const { rows } = await db.query(
      `INSERT INTO affiliate_payouts (affiliate_id, period_start, period_end, amount, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, affiliate_id, period_start, period_end, amount, status, created_at`,
      [affiliateId, periodStart, periodEnd, amount]
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    log('error', 'affiliates.createAffiliatePayout error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateAffiliatePayout(req: Request, res: Response) {
  try {
    const id = String(req.params?.id || '');
    const status = String(req.body?.status || '');
    if (!id || !['pending', 'approved', 'paid'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid payout update' });
    }

    const paidAt = status === 'paid' ? 'NOW()' : 'NULL';
    await db.query(
      `UPDATE affiliate_payouts
          SET status = $1,
              paid_at = ${paidAt}
        WHERE id = $2`,
      [status, id]
    );
    return res.json({ success: true, data: { updated: true } });
  } catch (err) {
    log('error', 'affiliates.updateAffiliatePayout error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

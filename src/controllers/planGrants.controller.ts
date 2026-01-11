// src/controllers/planGrants.controller.ts
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import db from '../config/database';
import { log } from '../utils/logger';

export async function createPlanGrant(req: AuthenticatedRequest, res: Response) {
  try {
    const targetType = String(req.body?.target_type || 'user');
    const targetId = String(req.body?.target_id || '');
    const plan = String(req.body?.plan || '');
    const durationMonths = Number(req.body?.duration_months || 1);
    const reason = String(req.body?.reason || 'manual_grant');
    const createdBy = req.user?.userId || null;

    if (!targetId || !plan || !['user', 'org'].includes(targetType)) {
      return res.status(400).json({ success: false, error: 'Invalid grant request' });
    }

    const { rows } = await db.query(
      `INSERT INTO plan_grants (target_type, target_id, plan, ends_at, reason, created_by)
       VALUES ($1, $2, $3, NOW() + ($4 || ' months')::interval, $5, $6)
       RETURNING id, target_type, target_id, plan, starts_at, ends_at, reason, created_at`,
      [targetType, targetId, plan, durationMonths, reason, createdBy]
    );

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    log('error', 'planGrants.createPlanGrant.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function listPlanGrants(_req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      `SELECT id, target_type, target_id, plan, starts_at, ends_at, reason, created_at
         FROM plan_grants
        ORDER BY created_at DESC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'planGrants.listPlanGrants.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

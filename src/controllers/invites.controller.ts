// src/controllers/invites.controller.ts
import type { Response } from 'express';
import { randomBytes } from 'crypto';
import db from '../config/database';
import type { OrgRequest } from '../middleware/org';
import { sendInviteEmail } from '../services/inviteEmails';
import { log } from '../utils/logger';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function createInvite(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    const inviterId = req.user?.userId;
    if (!orgId || !inviterId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const email = normalizeEmail(String(req.body?.email || ''));
    const role = String(req.body?.role || 'member');
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
    if (!['owner', 'admin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const { rows } = await db.query(
      `INSERT INTO invites (org_id, inviter_user_id, invitee_email, role, token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, invitee_email, role, token, status, created_at, expires_at`,
      [orgId, inviterId, email, role, token, expiresAt]
    );

    const emailRes = await sendInviteEmail({ to: email, token, inviter: req.user?.email || null });
    await db.query(`UPDATE invites SET last_reminded_at = NOW() WHERE id = $1`, [rows[0].id]);

    const payload = { ...rows[0], email_sent: emailRes.sent === true };
    return res.status(201).json({ success: true, data: payload });
  } catch (err) {
    log('error', 'invites.createInvite error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function listInvites(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { rows } = await db.query(
      `SELECT id, invitee_email, role, status, token, created_at, accepted_at, expires_at
         FROM invites
        WHERE org_id = $1
        ORDER BY created_at DESC`,
      [orgId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'invites.listInvites error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function revokeInvite(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    const id = String(req.params?.id || '');
    if (!orgId || !id) return res.status(400).json({ success: false, error: 'Invalid request' });

    await db.query(
      `UPDATE invites
          SET status = 'revoked'
        WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );

    return res.json({ success: true, data: { revoked: true } });
  } catch (err) {
    log('error', 'invites.revokeInvite error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function resendInvite(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    const id = String(req.params?.id || '');
    if (!orgId || !id) return res.status(400).json({ success: false, error: 'Invalid request' });

    const { rows } = await db.query(
      `SELECT invitee_email, token
         FROM invites
        WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Invite not found' });

    const emailRes = await sendInviteEmail({ to: rows[0].invitee_email, token: rows[0].token, inviter: req.user?.email || null });
    await db.query(`UPDATE invites SET last_reminded_at = NOW() WHERE id = $1`, [id]);

    return res.json({ success: true, data: { sent: emailRes.sent === true } });
  } catch (err) {
    log('error', 'invites.resendInvite error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

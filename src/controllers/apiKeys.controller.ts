import type { Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import type { OrgRequest } from '../middleware/org';
import db from '../config/database';
import { logAudit } from '../services/audit';

const ALLOWED_SCOPES = new Set([
  '*',
  'links:read',
  'links:write',
  'domains:read',
  'domains:write',
  'analytics:read',
  'org:read',
  'org:write',
  'tags:read',
  'tags:write',
  'groups:read',
  'groups:write',
  'audit:read',
  'api-keys:read',
  'api-keys:write',
  'invites:read',
  'invites:write',
]);

function normalizeScopes(input: unknown) {
  if (!input) return ['*'];
  const raw = Array.isArray(input) ? input : String(input).split(',');
  const cleaned = raw.map((s) => String(s).trim()).filter(Boolean);
  if (!cleaned.length) return ['*'];
  if (cleaned.includes('*')) return ['*'];
  const scopes = cleaned.filter((s) => ALLOWED_SCOPES.has(s));
  return scopes.length ? scopes : ['*'];
}

function generateKey() {
  const prefix = randomBytes(6).toString('hex');
  const secret = randomBytes(24).toString('hex');
  const key = `sk_live_${prefix}_${secret}`;
  const hash = createHash('sha256').update(key).digest('hex');
  return { key, prefix, hash };
}

export async function listApiKeys(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const { rows } = await db.query(
      `SELECT id, name, prefix, scopes, last_used_at, revoked_at, created_at
         FROM api_keys
        WHERE org_id = $1
        ORDER BY created_at DESC`,
      [orgId]
    );
    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error('listApiKeys error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createApiKey(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const userId = req.user?.userId ?? null;
    const name = String(req.body?.name ?? '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    const scopes = normalizeScopes(req.body?.scopes);

    const { key, prefix, hash } = generateKey();
    const { rows } = await db.query(
      `INSERT INTO api_keys (org_id, user_id, name, key_hash, prefix, scopes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, prefix, scopes, created_at`,
      [orgId, userId, name, hash, prefix, scopes]
    );

    await logAudit({
      org_id: orgId,
      user_id: userId,
      action: 'api_key.create',
      entity_type: 'api_key',
      entity_id: rows[0].id,
      metadata: { name, scopes },
    });

    return res.status(201).json({
      success: true,
      data: { ...rows[0], api_key: key },
    });
  } catch (e) {
    console.error('createApiKey error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function revokeApiKey(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const userId = req.user?.userId ?? null;
    const { id } = req.params;

    const { rows } = await db.query(
      `UPDATE api_keys
          SET revoked_at = NOW()
        WHERE id = $1 AND org_id = $2 AND revoked_at IS NULL
      RETURNING id, name, prefix, revoked_at`,
      [id, orgId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }

    await logAudit({
      org_id: orgId,
      user_id: userId,
      action: 'api_key.revoke',
      entity_type: 'api_key',
      entity_id: rows[0].id,
    });

    return res.json({ success: true, data: rows[0] });
  } catch (e) {
    console.error('revokeApiKey error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// src/controllers/webhooks.controller.ts
import type { Response } from 'express';
import { randomBytes } from 'crypto';
import db from '../config/database';
import type { OrgRequest } from '../middleware/org';
import { getOrgEntitlements, isFeatureEnabled } from '../services/entitlements';
import { buildWebhookPayload } from '../services/webhooks';
import { log } from '../utils/logger';

const ALLOWED_EVENTS = new Set(['link.created', 'link.deleted', 'click.recorded']);

function normalizeEvents(events: unknown): string[] | null {
  if (!Array.isArray(events) || !events.length) return null;
  const cleaned = events
    .map((event) => String(event || '').trim())
    .filter((event) => ALLOWED_EVENTS.has(event));
  return cleaned.length ? Array.from(new Set(cleaned)) : null;
}

function validateUrl(url: string) {
  try {
    const parsed = new URL(url);
    const allowHttp = process.env.WEBHOOK_ALLOW_HTTP === '1';
    if (!allowHttp && parsed.protocol !== 'https:') return false;
    return true;
  } catch {
    return false;
  }
}

async function ensureWebhooksEnabled(orgId: string) {
  const entitlements = await getOrgEntitlements(orgId);
  return isFeatureEnabled(entitlements, 'webhooks');
}

export async function listWebhooks(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    if (!orgId) return res.status(403).json({ success: false, error: 'No organization access' });
    if (!(await ensureWebhooksEnabled(orgId))) {
      return res.status(403).json({ success: false, error: 'Webhooks are not enabled for this plan' });
    }

    const { rows } = await db.query(
      `SELECT id, name, url, enabled, event_types, created_at, updated_at,
              (secret IS NOT NULL AND secret <> '') AS has_secret
         FROM webhook_endpoints
        WHERE org_id = $1
        ORDER BY created_at DESC`,
      [orgId],
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'webhooks.list.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createWebhook(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    if (!orgId) return res.status(403).json({ success: false, error: 'No organization access' });
    if (!(await ensureWebhooksEnabled(orgId))) {
      return res.status(403).json({ success: false, error: 'Webhooks are not enabled for this plan' });
    }

    const name = String(req.body?.name || '').trim();
    const url = String(req.body?.url || '').trim();
    const enabled = req.body?.enabled !== false;
    const eventTypesProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'event_types');
    const eventTypes = eventTypesProvided ? normalizeEvents(req.body?.event_types) : undefined;

    if (!name || !url) {
      return res.status(400).json({ success: false, error: 'name and url are required' });
    }
    if (!validateUrl(url)) {
      return res.status(400).json({ success: false, error: 'Webhook URL must be valid and HTTPS' });
    }

    const secret = randomBytes(24).toString('hex');
    const { rows } = await db.query(
      `INSERT INTO webhook_endpoints (org_id, name, url, enabled, secret, event_types, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, name, url, enabled, event_types, created_at, updated_at`,
      [orgId, name, url, enabled, secret, eventTypes],
    );
    return res.status(201).json({ success: true, data: { ...rows[0], secret } });
  } catch (err) {
    log('error', 'webhooks.create.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateWebhook(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    if (!orgId) return res.status(403).json({ success: false, error: 'No organization access' });
    if (!(await ensureWebhooksEnabled(orgId))) {
      return res.status(403).json({ success: false, error: 'Webhooks are not enabled for this plan' });
    }

    const id = String(req.params?.id || '');
    const name = req.body?.name ? String(req.body.name).trim() : null;
    const url = req.body?.url ? String(req.body.url).trim() : null;
    const enabled = req.body?.enabled;
    const eventTypesProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'event_types');
    const eventTypes = eventTypesProvided ? normalizeEvents(req.body?.event_types) : undefined;
    const rotateSecret = req.body?.rotate_secret === true;

    if (!id) return res.status(400).json({ success: false, error: 'Invalid webhook id' });
    if (url && !validateUrl(url)) {
      return res.status(400).json({ success: false, error: 'Webhook URL must be valid and HTTPS' });
    }

    const secret = rotateSecret ? randomBytes(24).toString('hex') : null;
    const { rows } = await db.query(
      `UPDATE webhook_endpoints
          SET name = COALESCE($2, name),
              url = COALESCE($3, url),
              enabled = COALESCE($4, enabled),
              event_types = CASE WHEN $5 THEN $6 ELSE event_types END,
              secret = CASE WHEN $7 IS NULL THEN secret ELSE $7 END,
              updated_at = NOW()
        WHERE id = $1 AND org_id = $8
      RETURNING id, name, url, enabled, event_types, created_at, updated_at,
                (secret IS NOT NULL AND secret <> '') AS has_secret`,
      [
        id,
        name,
        url,
        typeof enabled === 'boolean' ? enabled : null,
        eventTypesProvided,
        eventTypes ?? null,
        secret,
        orgId,
      ],
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Webhook not found' });
    return res.json({ success: true, data: { ...rows[0], secret: secret || undefined } });
  } catch (err) {
    log('error', 'webhooks.update.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function deleteWebhook(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    if (!orgId) return res.status(403).json({ success: false, error: 'No organization access' });

    const id = String(req.params?.id || '');
    if (!id) return res.status(400).json({ success: false, error: 'Invalid webhook id' });

    await db.query(`DELETE FROM webhook_endpoints WHERE id = $1 AND org_id = $2`, [id, orgId]);
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    log('error', 'webhooks.delete.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function testWebhook(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    if (!orgId) return res.status(403).json({ success: false, error: 'No organization access' });
    if (!(await ensureWebhooksEnabled(orgId))) {
      return res.status(403).json({ success: false, error: 'Webhooks are not enabled for this plan' });
    }

    const id = String(req.params?.id || '');
    if (!id) return res.status(400).json({ success: false, error: 'Invalid webhook id' });

    const payload = buildWebhookPayload('webhook.test', {
      org_id: orgId,
      sent_at: new Date().toISOString(),
      actor_id: req.user?.userId || null,
    });

    await db.query(
      `INSERT INTO webhook_deliveries (endpoint_id, org_id, event_type, payload, status, max_attempts)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [id, orgId, payload.type, JSON.stringify(payload), 3],
    );

    return res.json({ success: true, data: { queued: true } });
  } catch (err) {
    log('error', 'webhooks.test.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function listWebhookDeliveries(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    if (!orgId) return res.status(403).json({ success: false, error: 'No organization access' });
    if (!(await ensureWebhooksEnabled(orgId))) {
      return res.status(403).json({ success: false, error: 'Webhooks are not enabled for this plan' });
    }

    const endpointId = String(req.query?.endpoint_id || '').trim();
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 50)));
    const params: Array<string | number> = [orgId];
    let sql = `
      SELECT id, endpoint_id, event_type, status, attempt_count, max_attempts,
             next_attempt_at, last_attempt_at, last_error, response_status, duration_ms, created_at
        FROM webhook_deliveries
       WHERE org_id = $1
    `;
    if (endpointId) {
      params.push(endpointId);
      sql += ` AND endpoint_id = $${params.length}`;
    }
    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const { rows } = await db.query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    log('error', 'webhooks.deliveries.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

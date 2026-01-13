import { createHmac, randomUUID } from 'crypto';
import { getEcosystemConfig } from './ecosystem.service';
import db from '../config/database';
import { log } from '../utils/logger';
import { dispatchIntegrationEvent } from './integrations';
import { getOrgEntitlements, isFeatureEnabled } from './entitlements';

type WebhookConfig = {
  id: string;
  label?: string;
  enabled?: boolean;
  url?: string;
};

type WebhookPayload = {
  id: string;
  type: string;
  version: string;
  timestamp: string;
  data: Record<string, any>;
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 750;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WORKER_INTERVAL_MS = 2000;
const DEFAULT_WORKER_BATCH = 25;
const MAX_RESPONSE_BODY = 2048;
const SIGNATURE_VERSION = 'v1';
const PAYLOAD_VERSION = '2026-01-01';

function buildSignature(secret: string, timestamp: string, body: string) {
  const hmac = createHmac('sha256', secret);
  hmac.update(`${timestamp}.${body}`);
  return `sha256=${hmac.digest('hex')}`;
}

async function postWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function scheduleSend(
  hook: WebhookConfig,
  payload: WebhookPayload,
  attempt: number,
  maxRetries: number,
  timeoutMs: number,
  secret: string,
) {
  const url = String(hook.url || '').trim();
  if (!url) return;
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'OkLeaf-Webhooks/1.0',
    'X-Okleaf-Event': payload.type,
    'X-Okleaf-Id': payload.id,
    'X-Okleaf-Version': payload.version,
    'X-Okleaf-Timestamp': payload.timestamp,
  };
  if (secret) {
    headers['X-Okleaf-Signature'] = buildSignature(secret, payload.timestamp, body);
    headers['X-Okleaf-Signature-Version'] = SIGNATURE_VERSION;
  }

  const run = async () => {
    try {
      const res = await postWithTimeout(url, { method: 'POST', headers, body }, timeoutMs);
      if (!res.ok) {
        throw new Error(`Webhook ${hook.id} responded ${res.status}`);
      }
      log('info', 'webhook.sent', { hook_id: hook.id, url });
    } catch (err) {
      if (attempt < maxRetries) {
        const delay = DEFAULT_BACKOFF_MS * Math.pow(2, attempt - 1);
        log('warn', 'webhook.retry', {
          hook_id: hook.id,
          url,
          attempt,
          next_delay_ms: delay,
          error: String(err),
        });
        setTimeout(() => scheduleSend(hook, payload, attempt + 1, maxRetries, timeoutMs, secret), delay);
        return;
      }
      log('error', 'webhook.failed', { hook_id: hook.id, url, attempt, error: String(err) });
    }
  };

  void run();
}

type WebhookEndpointRow = {
  id: string;
  org_id: string;
  name: string;
  url: string;
  enabled: boolean;
  secret: string | null;
  event_types: string[] | null;
};

type WebhookDeliveryRow = {
  id: string;
  endpoint_id: string;
  org_id: string;
  event_type: string;
  payload: WebhookPayload;
  status: string;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  last_attempt_at: string | null;
  last_error: string | null;
  response_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  url: string;
  secret: string | null;
};

export function buildWebhookPayload(eventType: string, data: Record<string, any>): WebhookPayload {
  return {
    id: randomUUID(),
    type: eventType,
    version: PAYLOAD_VERSION,
    timestamp: new Date().toISOString(),
    data,
  };
}

export async function getEndpointsForOrg(orgId: string, eventType: string): Promise<WebhookEndpointRow[]> {
  const { rows } = await db.query<WebhookEndpointRow>(
    `SELECT id, org_id, name, url, enabled, secret, event_types
       FROM webhook_endpoints
      WHERE org_id = $1 AND enabled = true
        AND (event_types IS NULL OR $2 = ANY(event_types))
      ORDER BY created_at ASC`,
    [orgId, eventType],
  );
  return rows;
}

export async function enqueueWebhookDeliveries(endpoints: WebhookEndpointRow[], eventType: string, payload: WebhookPayload) {
  if (!endpoints.length) return;
  const maxAttempts = Number(process.env.WEBHOOK_MAX_ATTEMPTS || DEFAULT_MAX_ATTEMPTS);
  const values: string[] = [];
  const params: Array<string | number | boolean | object> = [];
  endpoints.forEach((endpoint, idx) => {
    const offset = idx * 6;
    values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
    params.push(endpoint.id, endpoint.org_id, eventType, JSON.stringify(payload), 'pending', maxAttempts);
  });
  await db.query(
    `INSERT INTO webhook_deliveries (endpoint_id, org_id, event_type, payload, status, max_attempts)
     VALUES ${values.join(', ')}`,
    params,
  );
}

function shouldRetry(status: number | null, error?: unknown) {
  if (error) return true;
  if (status === 429) return true;
  if (status && status >= 500) return true;
  if (status === 408) return true;
  return false;
}

function parseRetryAfter(retryAfter: string | null): number | null {
  if (!retryAfter) return null;
  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000;
  const date = Date.parse(retryAfter);
  if (!Number.isNaN(date)) {
    const diff = date - Date.now();
    return diff > 0 ? diff : null;
  }
  return null;
}

function nextDelay(attempt: number, retryAfterMs?: number | null) {
  if (retryAfterMs && retryAfterMs > 0) return retryAfterMs;
  const base = DEFAULT_BACKOFF_MS * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

async function markDeliverySuccess(id: string, status: number, body: string, durationMs: number) {
  await db.query(
    `UPDATE webhook_deliveries
        SET status = 'success',
            response_status = $2,
            response_body = $3,
            duration_ms = $4,
            updated_at = NOW()
      WHERE id = $1`,
    [id, status, body.slice(0, MAX_RESPONSE_BODY), durationMs],
  );
}

async function markDeliveryRetry(id: string, attempt: number, error: string, retryAfterMs?: number | null) {
  const delay = nextDelay(attempt, retryAfterMs);
  await db.query(
    `UPDATE webhook_deliveries
        SET status = 'pending',
            next_attempt_at = NOW() + ($2 || ' milliseconds')::interval,
            last_error = $3,
            updated_at = NOW()
      WHERE id = $1`,
    [id, delay, error],
  );
}

async function markDeliveryFailed(id: string, status: number | null, error: string) {
  await db.query(
    `UPDATE webhook_deliveries
        SET status = 'failed',
            response_status = $2,
            last_error = $3,
            updated_at = NOW()
      WHERE id = $1`,
    [id, status, error],
  );
}

async function deliverOne(row: WebhookDeliveryRow) {
  const payload = row.payload;
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'OkLeaf-Webhooks/1.0',
    'X-Okleaf-Event': payload.type,
    'X-Okleaf-Id': payload.id,
    'X-Okleaf-Version': payload.version,
    'X-Okleaf-Timestamp': payload.timestamp,
    'X-Okleaf-Delivery': row.id,
    'X-Okleaf-Attempt': String(row.attempt_count),
  };
  const secret = String(row.secret || process.env.WEBHOOK_SECRET || '').trim();
  if (secret) {
    headers['X-Okleaf-Signature'] = buildSignature(secret, payload.timestamp, body);
    headers['X-Okleaf-Signature-Version'] = SIGNATURE_VERSION;
  }
  const timeoutMs = Number(process.env.WEBHOOK_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await postWithTimeout(row.url, { method: 'POST', headers, body }, timeoutMs);
    const durationMs = Date.now() - start;
    const text = await res.text().catch(() => '');
    if (res.ok) {
      await markDeliverySuccess(row.id, res.status, text, durationMs);
      log('info', 'webhook.sent', { hook_id: row.endpoint_id, url: row.url, delivery_id: row.id });
      return;
    }
    const error = `Webhook responded ${res.status}`;
    if (row.attempt_count >= row.max_attempts || !shouldRetry(res.status)) {
      await markDeliveryFailed(row.id, res.status, error);
      log('error', 'webhook.failed', { hook_id: row.endpoint_id, url: row.url, attempt: row.attempt_count, error });
      return;
    }
    const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
    await markDeliveryRetry(row.id, row.attempt_count, error, retryAfter);
    log('warn', 'webhook.retry', {
      hook_id: row.endpoint_id,
      url: row.url,
      attempt: row.attempt_count,
      error,
    });
  } catch (err) {
    const error = String(err);
    if (row.attempt_count >= row.max_attempts || !shouldRetry(null, err)) {
      await markDeliveryFailed(row.id, null, error);
      log('error', 'webhook.failed', { hook_id: row.endpoint_id, url: row.url, attempt: row.attempt_count, error });
      return;
    }
    await markDeliveryRetry(row.id, row.attempt_count, error);
    log('warn', 'webhook.retry', {
      hook_id: row.endpoint_id,
      url: row.url,
      attempt: row.attempt_count,
      error,
    });
  }
}

async function fetchDueDeliveries(limit: number): Promise<WebhookDeliveryRow[]> {
  await db.query('BEGIN');
  try {
    const { rows } = await db.query<WebhookDeliveryRow>(
      `WITH due AS (
         SELECT d.id
           FROM webhook_deliveries d
           JOIN webhook_endpoints e ON e.id = d.endpoint_id
          WHERE d.status = 'pending'
            AND d.next_attempt_at <= NOW()
            AND e.enabled = true
          ORDER BY d.next_attempt_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
       ),
       updated AS (
         UPDATE webhook_deliveries d
            SET status = 'delivering',
                attempt_count = attempt_count + 1,
                last_attempt_at = NOW(),
                updated_at = NOW()
           FROM due
          WHERE d.id = due.id
          RETURNING d.*
       )
       SELECT u.*, e.url, e.secret
         FROM updated u
         JOIN webhook_endpoints e ON e.id = u.endpoint_id`,
      [limit],
    );
    await db.query('COMMIT');
    return rows;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

let webhookWorkerStarted = false;
export function startWebhookWorker() {
  if (webhookWorkerStarted) return;
  webhookWorkerStarted = true;
  const interval = Number(process.env.WEBHOOK_WORKER_INTERVAL_MS || DEFAULT_WORKER_INTERVAL_MS);
  const batchSize = Number(process.env.WEBHOOK_WORKER_BATCH || DEFAULT_WORKER_BATCH);
  setInterval(async () => {
    try {
      const deliveries = await fetchDueDeliveries(batchSize);
      if (!deliveries.length) return;
      await Promise.all(deliveries.map((row) => deliverOne(row)));
    } catch (err) {
      log('error', 'webhook.worker.error', { error: String(err) });
    }
  }, interval);
}

export async function emitWebhook(eventType: string, data: Record<string, any>) {
  try {
    const payload = buildWebhookPayload(eventType, data);
    const orgId = data?.org_id ? String(data.org_id) : '';
    if (orgId) {
      const entitlements = await getOrgEntitlements(orgId);
      if (!isFeatureEnabled(entitlements, 'webhooks')) return;
      const endpoints = await getEndpointsForOrg(orgId, eventType);
      if (endpoints.length) {
        await enqueueWebhookDeliveries(endpoints, eventType, payload);
      } else {
        const config = await getEcosystemConfig();
        const hooks = (config?.webhooks || []) as WebhookConfig[];
        const targets = hooks.filter((hook) => hook.enabled && hook.id === eventType && hook.url);
        if (!targets.length) return;
        const secret = String(process.env.WEBHOOK_SECRET || '').trim();
        const timeoutMs = Number(process.env.WEBHOOK_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
        const maxRetries = Number(process.env.WEBHOOK_MAX_RETRIES || DEFAULT_MAX_RETRIES);
        targets.forEach((hook) => scheduleSend(hook, payload, 1, maxRetries, timeoutMs, secret));
      }
    }
    void dispatchIntegrationEvent(payload);
  } catch (err) {
    log('error', 'webhook.emit.error', { error: String(err), event_type: eventType });
  }
}

import { createHmac, randomUUID } from 'crypto';
import { getEcosystemConfig } from './ecosystem.service';
import { log } from '../utils/logger';

type WebhookConfig = {
  id: string;
  label?: string;
  enabled?: boolean;
  url?: string;
};

type WebhookPayload = {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, any>;
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 750;

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
    'X-Okleaf-Timestamp': payload.timestamp,
  };
  if (secret) {
    headers['X-Okleaf-Signature'] = buildSignature(secret, payload.timestamp, body);
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

export async function emitWebhook(eventType: string, data: Record<string, any>) {
  try {
    const config = await getEcosystemConfig();
    const hooks = (config?.webhooks || []) as WebhookConfig[];
    const targets = hooks.filter((hook) => hook.enabled && hook.id === eventType && hook.url);
    if (!targets.length) return;

    const payload: WebhookPayload = {
      id: randomUUID(),
      type: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    const secret = String(process.env.WEBHOOK_SECRET || '').trim();
    const timeoutMs = Number(process.env.WEBHOOK_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    const maxRetries = Number(process.env.WEBHOOK_MAX_RETRIES || DEFAULT_MAX_RETRIES);

    targets.forEach((hook) => scheduleSend(hook, payload, 1, maxRetries, timeoutMs, secret));
  } catch (err) {
    log('error', 'webhook.emit.error', { error: String(err), event_type: eventType });
  }
}

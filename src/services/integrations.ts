import { getEcosystemConfig } from './ecosystem.service';
import { log } from '../utils/logger';

const DEFAULT_TIMEOUT_MS = 5000;

type WebhookPayload = {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, any>;
};

async function postJson(url: string, body: Record<string, any>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function slackMessage(payload: WebhookPayload) {
  const type = payload.type;
  const data = payload.data || {};
  if (type === 'link.created' || type === 'link.deleted') {
    const link = data.link || {};
    const verb = type === 'link.created' ? 'created' : 'deleted';
    return {
      text: `OkLeaf link ${verb}: ${link.short_url || link.short_code || 'link'}`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `*Link ${verb}*` } },
        { type: 'section', fields: [
          { type: 'mrkdwn', text: `*Short:*
${link.short_url || link.short_code || '—'}` },
          { type: 'mrkdwn', text: `*Destination:*
${link.original_url || '—'}` },
        ] },
      ],
    };
  }
  if (type === 'click.recorded') {
    return {
      text: `OkLeaf click: ${data.short_code || 'link'} (${data.country_code || '—'})`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: '*Click recorded*' } },
        { type: 'section', fields: [
          { type: 'mrkdwn', text: `*Short:*
${data.short_code || '—'}` },
          { type: 'mrkdwn', text: `*Country:*
${data.country_code || '—'}` },
        ] },
      ],
    };
  }
  return { text: `OkLeaf event: ${type}` };
}

async function sendGa4Event(payload: WebhookPayload, measurementId: string, apiSecret: string) {
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  const eventName = payload.type.replace('.', '_');
  const data = payload.data || {};
  const params: Record<string, any> = {
    event_id: payload.id,
    event_time: payload.timestamp,
    org_id: data.org_id || null,
    link_id: data.link_id || data.link?.id || null,
    short_code: data.short_code || data.link?.short_code || null,
  };
  if (payload.type === 'click.recorded') {
    params.country = data.country_code || null;
    params.city = data.city || null;
    params.referer = data.referer || null;
  }
  if (data.link?.short_url) params.short_url = data.link.short_url;
  if (data.link?.original_url) params.original_url = data.link.original_url;

  const body = {
    client_id: String(data.org_id || data.link_id || payload.id),
    events: [
      {
        name: eventName,
        params,
      },
    ],
  };

  await postJson(url, body);
}

export async function dispatchIntegrationEvent(payload: WebhookPayload) {
  try {
    const config = await getEcosystemConfig();
    const settings = config?.integrationSettings || {};

    const zapierUrl = String(settings?.zapier?.webhook_url || '').trim();
    if (zapierUrl) {
      void postJson(zapierUrl, payload).catch((err) => {
        log('warn', 'integration.zapier.failed', { error: String(err) });
      });
    }

    const slackUrl = String(settings?.slack?.webhook_url || '').trim();
    if (slackUrl) {
      const message = slackMessage(payload);
      void postJson(slackUrl, message).catch((err) => {
        log('warn', 'integration.slack.failed', { error: String(err) });
      });
    }

    const gaEnabled = Boolean(settings?.ga4?.enabled);
    const measurementId = String(settings?.ga4?.measurement_id || '').trim();
    const apiSecret = String(settings?.ga4?.api_secret || '').trim();
    if (gaEnabled && measurementId && apiSecret) {
      void sendGa4Event(payload, measurementId, apiSecret).catch((err) => {
        log('warn', 'integration.ga4.failed', { error: String(err) });
      });
    }
  } catch (err) {
    log('error', 'integration.dispatch.error', { error: String(err) });
  }
}

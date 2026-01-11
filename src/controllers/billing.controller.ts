// src/controllers/billing.controller.ts
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import db from '../config/database';
import type { OrgRequest } from '../middleware/org';
import { log } from '../utils/logger';

type BillingConfig = {
  stripe?: {
    publishable_key?: string;
    secret_key?: string;
    webhook_secret?: string;
  };
  prices?: Record<string, { monthly?: string; annual?: string }>;
  checkout?: { success_url?: string; cancel_url?: string };
  portal?: { return_url?: string };
  entitlements?: Record<string, { features?: Record<string, boolean>; limits?: Record<string, number | null> }>;
};

const DEFAULT_BILLING_CONFIG: BillingConfig = {
  stripe: {
    publishable_key: '',
    secret_key: '',
    webhook_secret: '',
  },
  prices: {},
  checkout: {
    success_url: '',
    cancel_url: '',
  },
  portal: {
    return_url: '',
  },
  entitlements: {},
};

async function getBillingConfigRaw(): Promise<BillingConfig> {
  try {
    const { rows } = await db.query(`SELECT value FROM site_settings WHERE key = $1 LIMIT 1`, ['billing_config']);
    return { ...DEFAULT_BILLING_CONFIG, ...(rows[0]?.value || {}) };
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
    if (code === '42P01') return DEFAULT_BILLING_CONFIG;
    throw err;
  }
}

function sanitizeBillingConfig(config: BillingConfig) {
  return {
    ...config,
    stripe: {
      publishable_key: config.stripe?.publishable_key || '',
      has_secret_key: Boolean(config.stripe?.secret_key),
      has_webhook_secret: Boolean(config.stripe?.webhook_secret),
    },
  };
}

function mergeBillingConfig(existing: BillingConfig, patch: BillingConfig): BillingConfig {
  const merged: BillingConfig = {
    ...existing,
    ...patch,
    stripe: { ...(existing.stripe || {}), ...(patch.stripe || {}) },
    prices: patch.prices ?? existing.prices ?? {},
    entitlements: patch.entitlements ?? existing.entitlements ?? {},
    checkout: { ...(existing.checkout || {}), ...(patch.checkout || {}) },
    portal: { ...(existing.portal || {}), ...(patch.portal || {}) },
  };

  const secret = patch.stripe?.secret_key;
  if (secret === null) merged.stripe!.secret_key = '';
  if (typeof secret === 'string' && secret.trim() === '') merged.stripe!.secret_key = existing.stripe?.secret_key || '';

  const webhook = patch.stripe?.webhook_secret;
  if (webhook === null) merged.stripe!.webhook_secret = '';
  if (typeof webhook === 'string' && webhook.trim() === '') {
    merged.stripe!.webhook_secret = existing.stripe?.webhook_secret || '';
  }

  return merged;
}

function getBaseUrl(req: Request): string {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function getStripe(config: BillingConfig) {
  const secret = config.stripe?.secret_key || '';
  if (!secret) throw new Error('Stripe secret key not configured');
  return new Stripe(secret, { apiVersion: '2024-06-20' });
}

function resolvePlanId(prices: BillingConfig['prices'], priceId: string): string | null {
  if (!prices) return null;
  for (const [planId, mapping] of Object.entries(prices)) {
    if (mapping?.monthly === priceId || mapping?.annual === priceId) return planId;
  }
  return null;
}

async function upsertSubscription(params: {
  orgId: string;
  subscriptionId: string;
  priceId: string | null;
  planId: string | null;
  status: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}) {
  await db.query(
    `INSERT INTO billing_subscriptions
      (org_id, stripe_subscription_id, stripe_price_id, plan_id, status, current_period_end, cancel_at_period_end, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (stripe_subscription_id)
     DO UPDATE SET
       org_id = EXCLUDED.org_id,
       stripe_price_id = EXCLUDED.stripe_price_id,
       plan_id = EXCLUDED.plan_id,
       status = EXCLUDED.status,
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       updated_at = NOW()`,
    [
      params.orgId,
      params.subscriptionId,
      params.priceId,
      params.planId,
      params.status,
      params.currentPeriodEnd,
      params.cancelAtPeriodEnd,
    ],
  );
}

async function syncStripePlanGrant(params: {
  orgId: string;
  planId: string | null;
  endsAt: Date | null;
  reason: string;
  active: boolean;
}) {
  await db.query(
    `DELETE FROM plan_grants WHERE target_type = 'org' AND target_id = $1 AND reason LIKE 'stripe:%'`,
    [params.orgId],
  );

  if (params.active && params.planId && params.endsAt) {
    await db.query(
      `INSERT INTO plan_grants (target_type, target_id, plan, ends_at, reason, created_by)
       VALUES ('org', $1, $2, $3, $4, NULL)`,
      [params.orgId, params.planId, params.endsAt, params.reason],
    );
  }
}

export async function getBillingConfig(req: Request, res: Response) {
  try {
    const config = await getBillingConfigRaw();
    return res.json({ success: true, data: sanitizeBillingConfig(config) });
  } catch (err) {
    log('error', 'billing.getBillingConfig.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateBillingConfig(req: Request, res: Response) {
  try {
    const payload = req.body ?? {};
    if (typeof payload !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }
    const existing = await getBillingConfigRaw();
    const merged = mergeBillingConfig(existing, payload);

    await db.query(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      ['billing_config', JSON.stringify(merged)],
    );

    return res.json({ success: true, data: sanitizeBillingConfig(merged) });
  } catch (err) {
    log('error', 'billing.updateBillingConfig.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createCheckoutSession(req: OrgRequest, res: Response) {
  try {
    const user = req.user;
    const org = req.org;
    if (!user?.userId || !org?.orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const planId = String(req.body?.plan_id || '').trim();
    const interval = String(req.body?.interval || 'monthly').toLowerCase();
    if (!planId || !['monthly', 'annual'].includes(interval)) {
      return res.status(400).json({ success: false, error: 'plan_id and interval are required' });
    }

    const config = await getBillingConfigRaw();
    const priceId = config.prices?.[planId]?.[interval as 'monthly' | 'annual'] || '';
    if (!priceId) {
      return res.status(400).json({ success: false, error: 'Plan is not configured for checkout' });
    }

    const stripe = getStripe(config);

    const customerRow = await db.query<{ stripe_customer_id: string }>(
      `SELECT stripe_customer_id FROM billing_customers WHERE org_id = $1 LIMIT 1`,
      [org.orgId],
    );

    let customerId = customerRow.rows[0]?.stripe_customer_id;
    if (!customerId) {
      const orgRow = await db.query<{ name: string }>(
        `SELECT name FROM orgs WHERE id = $1 LIMIT 1`,
        [org.orgId],
      );
      const customer = await stripe.customers.create({
        email: user.email,
        name: orgRow.rows[0]?.name || 'OkLeaf Org',
        metadata: { org_id: org.orgId },
      });
      customerId = customer.id;
      await db.query(
        `INSERT INTO billing_customers (org_id, user_id, stripe_customer_id)
         VALUES ($1, $2, $3)`,
        [org.orgId, user.userId, customerId],
      );
    }

    const baseUrl = getBaseUrl(req);
    const successUrl = config.checkout?.success_url || `${baseUrl}/admin/billing.html?success=1`;
    const cancelUrl = config.checkout?.cancel_url || `${baseUrl}/admin/billing.html?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: { org_id: org.orgId, plan_id: planId },
      },
      metadata: { org_id: org.orgId, plan_id: planId },
    });

    return res.json({ success: true, data: { url: session.url } });
  } catch (err) {
    log('error', 'billing.createCheckoutSession.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createPortalSession(req: OrgRequest, res: Response) {
  try {
    const user = req.user;
    const org = req.org;
    if (!user?.userId || !org?.orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const config = await getBillingConfigRaw();
    const stripe = getStripe(config);

    const customerRow = await db.query<{ stripe_customer_id: string }>(
      `SELECT stripe_customer_id FROM billing_customers WHERE org_id = $1 LIMIT 1`,
      [org.orgId],
    );
    const customerId = customerRow.rows[0]?.stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({ success: false, error: 'No billing profile found' });
    }

    const baseUrl = getBaseUrl(req);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: config.portal?.return_url || `${baseUrl}/admin/billing.html`,
    });

    return res.json({ success: true, data: { url: portal.url } });
  } catch (err) {
    log('error', 'billing.createPortalSession.error', { error: String(err) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function stripeWebhook(req: Request, res: Response) {
  try {
    const config = await getBillingConfigRaw();
    const secret = config.stripe?.webhook_secret || '';
    if (!secret) return res.status(400).send('Webhook secret not configured');

    const stripe = getStripe(config);
    const sig = req.headers['stripe-signature'];
    if (!sig || Array.isArray(sig)) return res.status(400).send('Missing signature');

    const event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      const priceId = sub.items?.data?.[0]?.price?.id || null;
      const planId = priceId ? resolvePlanId(config.prices, priceId) : null;
      const status = sub.status || null;
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
      const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);

      let orgId: string | null = null;
      if (customerId) {
        const { rows } = await db.query<{ org_id: string }>(
          `SELECT org_id FROM billing_customers WHERE stripe_customer_id = $1 LIMIT 1`,
          [customerId],
        );
        orgId = rows[0]?.org_id || null;
      }
      if (!orgId && sub.metadata?.org_id) orgId = sub.metadata.org_id;
      if (orgId) {
        await upsertSubscription({
          orgId,
          subscriptionId: sub.id,
          priceId,
          planId,
          status,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd,
        });

        const activeStatuses = new Set(['active', 'trialing', 'past_due']);
        const active = activeStatuses.has(status || '');
        const allowUntilEnd = active || cancelAtPeriodEnd;
        await syncStripePlanGrant({
          orgId,
          planId,
          endsAt: allowUntilEnd ? periodEnd : null,
          reason: `stripe:${sub.id}`,
          active: allowUntilEnd,
        });
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = invoice.subscription ? String(invoice.subscription) : null;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (subId && customerId) {
        const sub = await getStripe(config).subscriptions.retrieve(subId);
        const priceId = sub.items?.data?.[0]?.price?.id || null;
        const planId = priceId ? resolvePlanId(config.prices, priceId) : null;
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

        const { rows } = await db.query<{ org_id: string }>(
          `SELECT org_id FROM billing_customers WHERE stripe_customer_id = $1 LIMIT 1`,
          [customerId],
        );
        const orgId = rows[0]?.org_id || null;
        if (orgId) {
          await upsertSubscription({
            orgId,
            subscriptionId: sub.id,
            priceId,
            planId,
            status: sub.status || null,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          });
          await syncStripePlanGrant({
            orgId,
            planId,
            endsAt: periodEnd,
            reason: `stripe:${sub.id}`,
            active: true,
          });
        }
      }
    }

    return res.json({ received: true });
  } catch (err) {
    log('error', 'billing.stripeWebhook.error', { error: String(err) });
    return res.status(400).send('Webhook error');
  }
}

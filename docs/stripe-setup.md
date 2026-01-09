# Stripe Setup Guide

This guide explains how to connect Stripe, configure plans, and verify billing end-to-end.

## Overview

Stripe is used for:
- Subscription checkout (upgrade flow).
- Customer portal (manage plan, cancel, update payment).
- Webhooks to keep OkLeaf plan entitlements in sync.

Billing is configured in the Super Admin panel and stored in `site_settings.key = billing_config`.

## Required Stripe setup

1) Create products and prices in Stripe
- Create a Product per tier (e.g. Free/Pro/Enterprise).
- Add two recurring prices per paid tier:
  - Monthly
  - Annual
- Copy each Price ID (e.g. `price_123`).

2) Create a webhook endpoint
- Endpoint URL: `https://okleaf.link/api/billing/webhook`
- Select events:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `checkout.session.completed`
- Copy the webhook signing secret (e.g. `whsec_...`).

3) Get your API keys
- Publishable key: `pk_live_...`
- Secret key: `sk_live_...`

## Configure OkLeaf (Super Admin)

Navigate to **Admin → Billing**.

### Stripe connection
Fill these values and save:
- Publishable key
- Secret key
- Webhook secret
- Checkout success URL (recommended): `https://okleaf.link/admin/billing.html?success=1`
- Checkout cancel URL (recommended): `https://okleaf.link/admin/billing.html?canceled=1`
- Portal return URL (recommended): `https://okleaf.link/admin/billing.html`

### Pricing tiers (Plan IDs)
Go to **Admin → Site** and set stable Plan IDs (these are used for entitlements).
Examples:
- `free`
- `pro`
- `enterprise`

### Stripe price mapping
Back in **Admin → Billing**, map each Plan ID to the Stripe Price IDs:
- Monthly Price ID (e.g. `price_...`)
- Annual Price ID (e.g. `price_...`)

Save the mapping.

## Owner upgrade flow

Org owners/admins can:
- Choose Monthly/Annual
- Click **Upgrade** to open Stripe Checkout
- Use **Manage in Stripe** to open the Customer Portal

Plan entitlements are synchronized from Stripe webhooks and stored as:
`plan_grants` with reason `stripe:{subscription_id}`.

## Verify the flow

1) Complete a test checkout in Stripe (test mode).
2) Confirm webhook delivery succeeds.
3) In OkLeaf:
   - The org should have a new plan grant.
   - `GET /api/auth/me` should return `effective_plan` matching the Plan ID.
   - Custom domains should unlock if the plan is paid.

### Admin checklist

- Billing page shows **Stripe settings saved** and mapping saved.
- Stripe webhook endpoint shows 2xx deliveries.
- `billing_subscriptions` has a row for the org.
- `plan_grants` has `reason = stripe:{subscription_id}`.
- Org can open **Manage in Stripe** portal.

## Troubleshooting

- **Webhook errors**: Confirm the endpoint URL and signing secret match.
- **Plan not upgrading**: Confirm price IDs are mapped to correct Plan IDs.
- **Checkout fails**: Verify Stripe secret key is set and plan has price IDs.

## Coupons, discounts, and trials

- Stripe Checkout allows promotion codes by default.
- OkLeaf also supports internal coupons and plan grants (Super Admin → Billing).
- Use plan grants for manual upgrades, free months, or discounted periods.
- Use coupons for referral or promo campaigns when you want a code-based redemption flow.

## Affiliate payouts (manual flow)

Affiliate payouts are tracked in OkLeaf and paid externally for now.

Suggested workflow:
1) Track conversions in OkLeaf (Admin → Affiliates).
2) Approve payouts in OkLeaf (status: approved).
3) Pay via Stripe Transfers or manual payout.
4) Mark payout as paid in OkLeaf (status: paid).

Notes:
- The current system does not auto-initiate Stripe payouts.
- You can add Stripe Connect later if you want automated payouts.

## Data model (reference)

Tables used:
- `billing_customers`
- `billing_subscriptions`
- `plan_grants`
- `site_settings` (key: `billing_config`)

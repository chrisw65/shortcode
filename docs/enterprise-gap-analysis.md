# Enterprise Gap Analysis

This document summarizes current capabilities and where the system is below enterprise standard.

## Current capabilities (as implemented)

Platform
- Single API/redirect service (Node/Express) with Postgres
- Docker + systemd deployment on a single droplet
- Static public site and admin UI served from `/public`

Core product
- Short link creation, redirect, and basic analytics
- Custom domains with DNS TXT verification
- QR code generation
- Team org model (owner/admin/member)
- API keys for orgs

Billing and growth
- Stripe Checkout + Customer Portal endpoints (configurable via admin)
- Stripe webhook handling for subscriptions
- Plan grants stored for orgs (manual enforcement)

Analytics
- Click event capture in Postgres
- Geo enrichment (DB-IP City Lite)
- Top referrers/countries/cities, per-link events
- World map visualization and CSV export

## Maturity assessment (by area)

Architecture
- MVP (single service, no isolation between API and redirect)
- No queue for analytics ingestion
- No dedicated analytics store

Reliability and scale
- Single region, single droplet
- No multi-region failover or read replicas
- No automated DR/PITR playbook in code

Security and compliance
- No SSO (SAML/OIDC)
- No 2FA
- No WAF/edge rate limiting
- No centralized audit log UI

Data and performance
- Postgres handles analytics; no rollups or retention policy
- No Redis cache for hot redirects
- No background ingestion pipeline

Product features (enterprise expectations)
- No bulk import/export tooling
- No A/B testing or geo/device routing rules
- No password-protected links
- No UTM/campaign templates
- No approval workflows
- No webhooks for outbound integrations

Billing/entitlements
- Stripe plan mapping is configurable, but operational checks are manual
- No automated affiliate payouts (manual only)
- No entitlement enforcement beyond paid vs free

## Missing or below enterprise standard (gap list)

Critical
- Separate redirect service for low-latency, high-availability
- Redis cache and rate limiting for redirect path
- Analytics pipeline to ClickHouse/TimescaleDB

High
- SSO + 2FA and advanced auth controls
- Audit log UI and immutable storage
- Multi-region deployment and failover
- Formal backup + DR runbooks

Medium
- Bulk link tools (CSV import/export)
- DNS automation for domain verification
- A/B testing and geo/device routing
- Webhooks and integrations
- Granular plan entitlements and quotas

Low
- Polished affiliate dashboard + automated payouts
- Admin tooling for pricing/entitlement experiments

## Additional gaps to address (from latest review)

Billing & entitlements
- Stripe integration is present but not fully operationalized (pricing sync, coupons, trials, invoices)
- Entitlements are not enforced end-to-end (domains, features, limits)
- Affiliate payouts lack automated ledgers and payout workflows

Security, compliance, and audit
- No immutable audit log UI or export
- No data retention policies, GDPR tooling, or SOC2-ready controls

CMS / docs
- Docs are CMS HTML-driven but lack a WYSIWYG editor
- Some pages still have hardcoded sections (reduced, but not eliminated)

## Recommended next steps (short)

1) Add a redirect service and Redis cache.
2) Introduce a queue for click ingestion.
3) Move analytics to ClickHouse/Timescale.
4) Implement SSO + 2FA and audit log UI.
5) Expand product features (bulk, routing, webhooks).

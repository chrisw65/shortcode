# Phase 3 Build Plan (Enterprise Track)

Goal: evolve the MVP into a Bitly‑class, enterprise‑grade platform.

## 1) Target Architecture
Services:
- API Service: auth, link management, domains, admin UI.
- Redirect Service: ultra‑lean redirect path with cache‑first lookups.
- Analytics Worker: async ingestion from queue into analytics DB.
- Analytics API: read‑optimized stats and exports.

Data stores:
- Postgres: users, links, domains, orgs, API keys.
- Redis: redirect cache + rate limit counters.
- ClickHouse or TimescaleDB: click events + aggregates.

Infra:
- Container registry + CI/CD
- Multi‑node deployment (droplet → k8s later)
- Monitoring + alerting

## 2) Phase 3.1 (Foundations)
Deliverables:
- API keys with scopes
- Org + team model (multi‑tenant)
- Role‑based access control (owner/admin/member)
- Audit log table and basic UI view

Tasks:
1) Add org tables and membership schema
2) Add API keys table + issuance endpoints
3) Introduce role checks in API layer
4) Add audit log events for link/domain changes

## 3) Phase 3.2 (Scale & Performance)
Deliverables:
- Redirect service with Redis cache
- Queue for click events
- Analytics ingestion worker

Tasks:
1) Split redirect route into its own service
2) Implement Redis cache (short_code → URL)
3) Add queue (BullMQ or RabbitMQ)
4) Move click writes off the request path

## 4) Phase 3.3 (Enterprise Controls)
Deliverables:
- SSO (SAML/OIDC) + 2FA
- Admin policy controls
- Configurable rate limits

Tasks:
1) SSO integration selection + proof‑of‑concept
2) Admin policy table + enforcement middleware
3) Per‑org rate limits and quotas

## 5) Phase 3.4 (Advanced Product)
Deliverables:
- Bulk link creation
- Branded domains automation
- A/B testing + geo routing

Tasks:
1) Bulk upload and CSV import/export
2) Automated DNS verification (provider API)
3) Link routing rules by geo/device

## 6) Decision Log (Needed)
Open decisions to lock down before execution:
- Analytics DB choice: ClickHouse vs TimescaleDB
- Queue choice: Redis/BullMQ vs RabbitMQ
- SSO provider: Auth0/Okta/Custom
- Deployment target: droplet now vs k8s now

## 7) Definition of Done
- 99.9% redirect uptime target
- p95 redirect latency < 50ms
- Audit log coverage for all admin actions
- External API keys for integrations

# Enterprise Roadmap (Draft)

This roadmap turns the gap list into a phased delivery plan. Phases assume the current single-droplet deployment and focus on risk reduction first, then enterprise capabilities, then growth tooling.

## Phase 1: Foundations (Stability + Compliance)

Goals
- Make the platform reliable, secure, and auditable.
- Establish clear operational controls.

Scope
- Audit log UI (org + super admin) with export
- Data retention policies + GDPR tools (export/delete)
- IP anonymization option
- Terms-of-service acceptance tracking
- Multi-org switching + org settings panel
- System status + error reporting (basic observability)
- Backups + restore playbook
- Rate-limit headers (X-RateLimit-*)
- API versioning (`/api/v1`)
- OpenAPI/Swagger docs

Deliverables
- `audit_logs` UI and export
- `org_settings` page and API
- `/api/v1` routing + OpenAPI JSON
- Data export/deletion endpoints + admin UI
- Backups doc + retention policy config

## Phase 2: Growth & Team Operations

Goals
- Make the system usable for teams at scale.
- Add core growth tools.

Scope
- Pending invite flows + acceptance UI
- Bulk link create/delete/export
- Link tags/categories + search improvements
- Link groups/campaigns
- UTM builder
- Link preview (OG/meta)
- Pagination improvements for links list
- Real-time analytics dashboard (live updates)

Deliverables
- Bulk import/export UI + CSV
- Campaigns UI + API
- Tags + filtering + full-text search
- Invite acceptance UX + resend limits
- Live dashboard channel (websocket or polling)

## Phase 3: Enterprise Revenue + Analytics Depth

Goals
- Monetization readiness and enterprise analytics.

Scope
- Stripe fully wired (tiers, coupons, trials, invoices)
- Entitlements enforcement (domains/features/limits)
- Affiliate ledger + payout pipeline
- Conversion tracking (pixel + webhook)
- Analytics export (CSV/PDF)
- Click maps/heatmaps
- Deep-link support for mobile
- A/B testing / split routing
- Password-protected links

Deliverables
- Billing engine + plan enforcement
- Affiliate dashboard + payout history
- Conversion tracking endpoints
- Click map module + export
- Split routing rules engine

## Phase 4: Ecosystem & Extensions

Goals
- Extend the platform into external workflows.

Scope
- Webhooks (events for links/clicks)
- Integrations (Zapier, Slack)
- Browser extension + bookmarklet
- CNAME + SSL guidance and monitoring
- Domain health monitoring and alerts
- Mobile-first polish + theme toggle

Deliverables
- Webhook registry + retry queue
- Integrations catalog
- Extension + bookmarklet
- Domain health dashboard

## Suggested sequencing logic

1) Ship Phase 1 to reduce risk and enable enterprise procurement.
2) Phase 2 for team productivity and growth workflows.
3) Phase 3 for revenue and analytics depth.
4) Phase 4 for ecosystem scale.

## Assumptions

- Single droplet is acceptable until Phase 3+ scale work.
- Existing Postgres remains the system of record.
- ClickHouse remains a future upgrade if analytics volume grows.

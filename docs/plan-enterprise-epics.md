# Enterprise Roadmap: Epics, Milestones, Estimates

This expands `docs/plan-enterprise.md` into delivery epics with rough effort ranges.

## Epic 1: Core platform split (4-6 weeks)
Objective: separate redirect from API for scale.
Scope:
- Redirect service with minimal dependencies
- Shared data model for links
- Health checks and structured logs
Milestones:
- M1: Redirect service MVP (2-3 weeks)
- M2: API + redirect deployed separately (1-2 weeks)
Risks:
- Increased ops complexity

## Epic 2: Caching + queue (4-6 weeks)
Objective: reduce latency and avoid DB write amplification.
Scope:
- Redis cache for short_code lookups
- Queue for click events (Redis/Bull or Kafka)
- Async worker for analytics ingestion
Milestones:
- M1: Redis cache hit path (2 weeks)
- M2: Async click ingestion (2-3 weeks)
Risks:
- Cache invalidation rules

## Epic 3: Analytics database (4-8 weeks)
Objective: separate analytics from transactional DB.
Scope:
- ClickHouse or TimescaleDB ingestion
- Aggregations for dashboard and exports
- Retention policy + rollups
Milestones:
- M1: Dual-write to analytics DB (2-3 weeks)
- M2: Dashboard powered by analytics DB (2-3 weeks)
Risks:
- Data consistency and backfill

## Epic 4: Enterprise auth + orgs (4-8 weeks)
Objective: support teams and enterprise access.
Scope:
- Orgs, roles, and permissions
- API keys with scopes
- SSO (SAML/OIDC) + 2FA
Milestones:
- M1: Org + role model (2-3 weeks)
- M2: API keys + scopes (1-2 weeks)
- M3: SSO integration (2-3 weeks)
Risks:
- Security review and compliance

## Epic 5: Reliability + compliance (4-8 weeks)
Objective: enterprise-ready uptime and controls.
Scope:
- SLOs and alerts
- Backups and DR runbooks
- Audit logs and tamper evidence
Milestones:
- M1: Monitoring + alerting (1-2 weeks)
- M2: Backups + DR drills (2-3 weeks)
- M3: Audit logs (1-2 weeks)
Risks:
- Operational overhead

## Epic 6: Product features (ongoing)
Objective: match Bitly-level features.
Scope:
- Bulk uploads and API
- Branded domains and DNS automation
- Geo routing, A/B testing, and campaigns
 - Referral program, coupons, and affiliate payouts
Milestones:
- Rolling releases by tier
Risks:
- Scope creep

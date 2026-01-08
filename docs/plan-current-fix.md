# Plan: Stabilize Current MVP

Goal: confirm the current MVP works end-to-end and remove the most likely failure points.

## Phase 1: Verify production as-is (1 day)
1) Confirm `oklink.lnk` DNS and TLS
2) Verify `/health` and `/admin/` from external network
3) Create user, create link, test redirect
4) Confirm analytics events appear after redirects
5) Confirm domain verification flow (TXT record)

Deliverables:
- A verification checklist with timestamps
- A baseline uptime check

## Phase 2: Reliability + security fixes (1-3 days)
1) Add missing operational checks and alerts (health, disk, memory)
2) Add error logging with correlation IDs
3) Add safer default headers and request size limits (already present but verify)
4) Add admin password rotation and remove default admin in production
5) Add rate limits for redirect endpoints (separate limit from API)

Deliverables:
- Hardened prod config
- Incident checklist

## Phase 3: Data correctness + performance (3-7 days)
1) Add Postgres indexes for redirect lookups and analytics queries
2) Evaluate Redis for redirect cache and rate limiting
3) Add async click logging queue (optional)
4) Add analytics retention policy and pruning

Deliverables:
- Measured redirect latency and p95
- Clear data retention plan

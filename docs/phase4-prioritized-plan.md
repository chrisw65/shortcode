# Phase 4 Completion & Transition Plan

## Objective
Close the remaining Phase 4 polish gaps (UI consistency, admin/marketing coverage, CMS stability, analytics, deployment scripts, docs) and then re‑engage Phases 1‑3 along with the requested auth/resilience upgrades plus Google login.

## Phase 4 polish priorities (week 0‑1)
1. **Public/admin UI cohesion** (feature work finished)
   - Premium branding now spans every public marketing page and the admin shell; CMS data feeds hero/footer/social copy so branding is centralized (`site.js`, `site.css`, `site-settings.js`, etc.).  
   - Links/settings/ecosystem dashboards use tabbed panels so each area is easy to scan.  
   - Toasts/notifications are now consistent, QR downloads are modals, and custom slug availability is live.
2. **Admin tooling** (feature work finished)
   - Every admin nav shows “Ecosystem”; the login SSO card uses the same premium inputs and the marketing contact form shares the toast helper.  
   - Email templates, hero/stats sections, and analytics cards remain authorable via the CMS so the marketing content can be updated without additional code changes.
3. **Analytics & redirect experience** (feature work finished)
   - The admin analytics surface now breaks into Summary/Geo/Events tabs, exports/copy helpers, sparkline, and world-map dots with country/city tables.
   - Toast handling and QR modals are in place, the favicon is served, and the public UI avoids the prior 429/500 issues.
4. **Devops & deployment** (pending validation)
   - Remote deployment script and `shortlink.service` work, but the production smoke checklist (DNS automation + TXT verification, 2FA cleanup, Redis/cache metrics, `SERVICE_MODE` validation, CSP headers, history exports) still needs manual execution.
   - Document the remaining Redis/cache architecture notes, move unused assets to `legacy/` for safety, and keep `docs/status-matrix.md` as the source of truth until Phase 1‑3 work officially begins.

## Phase 1‑3 backlog (after Phase 4)
1. **Platform foundation (Phase 1)**
   - Separation between redirect/API, Redis cache, click queue, and analytics store (ClickHouse). Validate that Redis is not just deployed but used for caching/ratelimiting; add docs describing benefits (performance/scale).
   - Improve multi-tenant org model (owner/team memberships, team seats, org analytics, domain/entitlement gating per tier).
2. **Security/compliance (Phase 2)**
   - Add audit log UI/export, SSO/Google login (with Zitadel/Auth0 config), 2FA controls, permissions tiers, and configurable entitlements (domains per tier, invitation workflows).
   - Ensure billing/pricing is configurable via Stripe integration (super admin panel) and that affiliate payouts/coupons/trials can be managed.
3. **Reliability/scale (Phase 3)**
   - Document SLOs, autoscaling/backups, CDN edge, multi-region redirect, and monitoring/alerting improvements.

## Immediate next step
Finish Phase 4 polish by closing the public/admin UI gaps, repoint the analytics display, and rerun the production smoke checklist with the updated UI/UX. Once that’s shipped, we’ll circle back to the Phase 1‑3 backlog and finally layer in the Google login requirement.

# Phase 4 Completion & Transition Plan

## Objective
Close the remaining Phase 4 polish gaps (UI consistency, admin/marketing coverage, CMS stability, analytics, deployment scripts, docs) and then re‑engage Phases 1‑3 along with the requested auth/resilience upgrades plus Google login.

## Phase 4 polish priorities (week 0‑1)
1. **Public/admin UI cohesion**
   - Ensure premium template renders on every public page (home, about, contact, ecosystem, bill) and that CMS data drives the hero, footer, branding, and social icons consistently.
   - Build tabs where the UX expects them (links list, site settings, billing) and wire tab content to sections so long pages behave as intended.
   - Improve toast/feedback surfaces (copy link, export CSV, CMS saves) and show availability/duplicates when choosing a custom slug.
2. **Admin tooling**
   - Surface the `/ecosystem` entry in every admin nav item (main, owner, affiliate) and add a nav link for the public page.
   - Add the tabs/segmentation requested for links and settings, fix the org ID field styling on login, and make contact form elements and captcha match the premium design.
   - Improve email templates, add CMS access for all hero/stat sections (Campaign control, analytics blocks, etc.), and ensure CMS updates propagate everywhere.
3. **Analytics & redirect experience**
   - Replace the placeholder hexagons with an accessible world map outline, show country/city detail, and add filters/export for analytics dashboards.
   - Fix toast and QR behaviour (popup for QR, check analytics code for custom slug). Ensure favicon, spa navigation, and toasts work without 429/500 errors.
4. **Devops & deployment**
   - Verify the remote deploy script remains valid, check droplet service files, and run smoke tests (link creation, redirects, analytics, CMS, DNS verification).
   - Document missing or legacy assets, move unused items to `legacy/`, and validate Redis/cache usage (in doc). Update docs to include the plan for global deployment (digitalocean, droplet).

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

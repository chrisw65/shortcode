# Status Matrix

This matrix compares the roadmap entries (Phases 1–4) to the code that actually exists in the repository so we can tell what is truly complete and what still needs work. Each row cites the relevant files/patterns.

| Phase or area | Actual code status | Notes / references |
| --- | --- | --- |
| **Phase 4 – Public/admin UI polish** | **Done** | Tabs and premium layouts are implemented (e.g., `/public/admin/links.html`, `/public/admin/site-settings.html`, `/public/admin/ecosystem.html` include tab sections). Analytics has Summary/Geo/Events sections plus copy/exports (`/public/admin/analytics.html`, `/public/admin/analytics.js`). Public site uses shared theme + toast helper (`/public/site.js`, `/public/site.css`) and the contact form fires toasts (`/public/contact.js`). |
| **Phase 4 – DevOps/operational checks** | **Pending** | The doctl/deploy smoke script exists (`scripts/deploy-to-droplet.sh`), but the post-deploy checklist (DNS automation, 2FA clean up, redis/cache metrics, `SERVICE_MODE` workers, CSP headers) has not been executed and is listed as “pending validation” (`docs/phase4-tests-todo.md`). |
| **Phase 1 – Platform foundation** | **Missing** | There is no dedicated redirect-only service, Redis caching layer, click queue, or ClickHouse analytics store in `src/`. API key issuance and scoped tokens are not implemented (`src/controllers/apiKeys.controller.ts` only exists but multi-tenant org/team enforcement is still basic). |
| **Phase 2 – Security/compliance** | **Partial** | Audit logging exists server-side (`src/services/audit.ts`, `src/routes/audit.routes.ts`) and the admin UI can fetch/export logs, and SSO flows exist (`src/controllers/auth.controller.ts`, `/admin/index.html`). However, Google login / additional IdP flows, Stripe-backed entitlements/coupons/affiliates, configurable 2FA/admin roles, and policy enforcement per plan are still not wired (no `stripe` integration code, no Google provider, no advanced entitlements UI). |
| **Phase 3 – Reliability/scale** | **Not started** | The service is single-region, with no CDN/edge caching, read replicas, autoscaling, or DR documentation. Nothing resembling multi-region deployments appears in `k8s/` or `scripts/` yet. |

Use this matrix as the source of truth for approx status; the Phase 4 documents should point to this file rather than trying to guess whether something is complete.

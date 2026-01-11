# Phase 4 Test TODO

## Recently validated
- ✅ Tabbed Ecosystem admin panels load, persist last tab, and round-trip webhook/integration changes. See `docs/status-matrix.md`.
- ✅ Analytics dashboard now sections into Summary|Geo|Events, includes CSV exports, copy-to-clipboard, country filter, sparkline, and map dots (`public/admin/analytics.html` & `.js`).
- ✅ Public contact page uses the shared toasts for success/failure so the notice stays in sync with inline copy (`public/contact.js`, `public/site.js`).
- ✅ Premium hero/footer data and social icons remain fully editable through the site CMS, and the login form uses the premium SSO card everywhere (`public/admin/site-settings.js` + shared CSS).

## Pending validation (operational/DevOps)
- 2FA cleanup: test user `smoke2fa+1768085603@example.com` still exists (owner-only deletion blocked).
- DNS automation: configure Cloudflare env vars and verify TXT/CNAME auto-provisioning.
- Routing rules: verify country/device/platform overrides across real traffic.
- Redirect cache: validate Redis cache hit ratio under load.
- Worker mode: run a redirect-only service with `SERVICE_MODE=redirect` and verify clicks enqueue.
- API-only mode: run `SERVICE_MODE=api` and confirm redirects are handled by separate service.
- Security headers: verify CSP/helmet response headers in redirect-only mode.
- Admin UI: 2FA setup + login flow across fresh users.

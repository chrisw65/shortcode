# Phase 4 Test TODO

## Pending validation
- 2FA cleanup: test user `smoke2fa+1768085603@example.com` still exists (owner-only deletion blocked).
- DNS automation: configure Cloudflare env vars and verify TXT/CNAME auto-provisioning.
- Routing rules: verify country/device/platform overrides across real traffic.
- Redirect cache: validate Redis cache hit ratio under load.
- Worker mode: run a redirect-only service with `SERVICE_MODE=redirect` and verify clicks enqueue.
- API-only mode: run `SERVICE_MODE=api` and confirm redirects are handled by separate service.
- Security headers: verify CSP/helmet response headers in redirect-only mode.
- Admin UI: 2FA setup + login flow across fresh users.

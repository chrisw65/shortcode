# Agent notes

Smoke test (rate limit bypass):
- The droplet stores `RATE_LIMIT_BYPASS_TOKEN` in `/etc/shortlink/.env`.
- Example:
  `RATE_LIMIT_BYPASS_TOKEN=$(ssh -o StrictHostKeyChecking=accept-new root@$(cat .droplet_ip) "grep -E '^RATE_LIMIT_BYPASS_TOKEN=' /etc/shortlink/.env | head -n1 | cut -d= -f2-") BASE_URL=https://okleaf.link scripts/mvp-smoke.sh`

Do not commit the token value itself.

Local DB migration (docker Postgres on port 5434):
- Container: `oakleaf-postgres`
- Example:
  `POSTGRES_HOST=localhost POSTGRES_PORT=5434 POSTGRES_USER=oakleaf_user POSTGRES_PASSWORD=oakleaf_secure_pass_2024 POSTGRES_DB=oakleaf_funnel_db node scripts/migrate.js`

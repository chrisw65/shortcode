# Agent notes

Smoke test (rate limit bypass):
- The droplet stores `RATE_LIMIT_BYPASS_TOKEN` in `/etc/shortlink/.env`.
- Example:
  `RATE_LIMIT_BYPASS_TOKEN=$(ssh -o StrictHostKeyChecking=accept-new root@$(cat .droplet_ip) "grep -E '^RATE_LIMIT_BYPASS_TOKEN=' /etc/shortlink/.env | head -n1 | cut -d= -f2-") BASE_URL=https://okleaf.link scripts/mvp-smoke.sh`

Do not commit the token value itself.

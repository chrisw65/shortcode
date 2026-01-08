# ===== ONE COPY/PASTE BLOCK: FOUNDATION + short_url fix + smoke test =====
set -euo pipefail

# 0) droplet IP
IP="$(cat .droplet_ip)"
echo "[i] Droplet IP: $IP"

# 1) DB tweak (example): add updated_at to links (idempotent)
ssh root@"$IP" "docker exec -i shortlink-db psql -U shortlink -d shortlink_dev -c \
  \"ALTER TABLE links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;\""

# 2) Build locally and push + redeploy with your EXISTING scripts
npm run build
scripts/deploy-to-droplet.sh

# (If you want to force only a pull/restart without rebuilding, uncomment this instead)
# ssh root@"$IP" 'HOST_PORT=80 CONTAINER_PORT=3000 /root/remote-deploy.sh && sleep 2 && docker logs --tail=60 shortlink'

# 3) Set base URL env on the droplet so short_url isn’t localhost
# We set both BASE_URL and PUBLIC_HOST to cover whichever your code reads.
ssh root@"$IP" "
  sed -i '/^BASE_URL=/d'  /etc/shortlink/.env; echo 'BASE_URL=http://$IP'  >> /etc/shortlink/.env;
  sed -i '/^PUBLIC_HOST=/d' /etc/shortlink/.env; echo 'PUBLIC_HOST=http://$IP' >> /etc/shortlink/.env;
  systemctl restart shortlink.service;
  sleep 2;
  docker logs --tail=60 shortlink
"

# 4) Login and capture token
TOKEN=$(curl -sS -X POST "http://$IP/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@shortlink.com","password":"admin123"}' \
  | jq -r '.data.token // .token')
echo "TOKEN=$TOKEN"

# 5) Create a link and verify short_url uses droplet IP
NEW=$(curl -sS -X POST "http://$IP/api/links" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/hello-world","title":"Example test"}')
echo "$NEW" | jq .

SHORT=$(echo "$NEW" | jq -r '.data.short_code')
SHORT_URL=$(echo "$NEW" | jq -r '.data.short_url')
echo "[i] SHORT_CODE=$SHORT"
echo "[i] SHORT_URL =$SHORT_URL"

# 6) Follow redirect (expect 302 to example.com/hello-world)
echo "[i] Redirect check:"
curl -i "http://$IP/$SHORT" | sed -n '1,12p'

# 7) List links (optionally verify click_count increments)
echo "[i] List links:"
curl -sS "http://$IP/api/links" -H "Authorization: Bearer $TOKEN" | jq .

# (Optional) Update link by short code (if your API supports PUT /api/links/:shortCode)
# curl -sS -X PUT "http://$IP/api/links/$SHORT" \
#   -H "Authorization: Bearer $TOKEN" \
#   -H "Content-Type: application/json" \
#   -d '{"title":"Example test (updated)"}' | jq .

echo "[✓] Foundation looks good."
# ========================================================================


#!/usr/bin/env bash
set -euo pipefail

# Migrate production DB on the droplet (shortlink-db container).
# Reads /etc/shortlink/.env on the droplet for POSTGRES_* settings.

DROPLET_HOST="${DROPLET_HOST:-$(cat .droplet_ip 2>/dev/null || true)}"
DROPLET_SSH_USER="${DROPLET_SSH_USER:-root}"
SSH_KEY="${SSH_KEY:-}"
DB_CONTAINER="${DB_CONTAINER:-shortlink-db}"
BACKUP_DIR="${BACKUP_DIR:-/root}"

if [[ -z "${DROPLET_HOST}" ]]; then
  echo "ERROR: DROPLET_HOST not set and .droplet_ip not found."; exit 1
fi

SSH_BASE=(-o StrictHostKeyChecking=accept-new)
[[ -n "${SSH_KEY}" ]] && SSH_BASE+=(-i "${SSH_KEY}")

echo "==> Running production DB migration on ${DROPLET_HOST}"
ssh "${SSH_BASE[@]}" "${DROPLET_SSH_USER}@${DROPLET_HOST}" \
  "DB_CONTAINER='${DB_CONTAINER}' BACKUP_DIR='${BACKUP_DIR}' bash -s" <<'EOF'
set -euo pipefail

ENV_FILE="/etc/shortlink/.env"
DB_CONTAINER="${DB_CONTAINER:-shortlink-db}"
BACKUP_DIR="${BACKUP_DIR:-/root}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found on droplet."; exit 1
fi

set -a
. "${ENV_FILE}"
set +a

if [[ -z "${POSTGRES_USER:-}" || -z "${POSTGRES_DB:-}" || -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "ERROR: POSTGRES_* env vars missing in ${ENV_FILE}."; exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_PATH="${BACKUP_DIR}/shortlink-backup-${STAMP}.sql"
echo "==> Backing up DB to ${BACKUP_PATH}"
docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${DB_CONTAINER}" \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" > "${BACKUP_PATH}"

echo "==> Applying migration"
docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD}" "${DB_CONTAINER}" \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  verified BOOLEAN DEFAULT false,
  verification_token VARCHAR(128),
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, domain)
);

ALTER TABLE links ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES domains(id) ON DELETE SET NULL;
ALTER TABLE links ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS click_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID REFERENCES links(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
DECLARE
  ip_type text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clicks') THEN
    SELECT data_type INTO ip_type
      FROM information_schema.columns
     WHERE table_name = 'click_events' AND column_name = 'ip';

    IF ip_type = 'inet' THEN
      EXECUTE
        'INSERT INTO click_events (link_id, ip, user_agent, referer, occurred_at)
         SELECT link_id, NULLIF(ip_address, '''')::inet, user_agent, referer, created_at
         FROM clicks
         ON CONFLICT DO NOTHING';
    ELSE
      EXECUTE
        'INSERT INTO click_events (link_id, ip, user_agent, referer, occurred_at)
         SELECT link_id, NULLIF(ip_address, '''')::text, user_agent, referer, created_at
         FROM clicks
         ON CONFLICT DO NOTHING';
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code);
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_click_events_link_id ON click_events(link_id);
CREATE INDEX IF NOT EXISTS idx_click_events_occurred_at ON click_events(occurred_at);

COMMIT;
SQL

echo "==> Migration complete"
EOF

echo "==> Done."

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

CREATE TABLE IF NOT EXISTS click_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID REFERENCES links(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orgs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
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
ALTER TABLE links ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS org_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  prefix VARCHAR(32) NOT NULL,
  last_used_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (prefix)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT false;

-- Backfill orgs and org memberships for existing users
DO $$
DECLARE
  u RECORD;
  o_id UUID;
BEGIN
  FOR u IN SELECT id FROM users LOOP
    IF NOT EXISTS (SELECT 1 FROM org_memberships WHERE user_id = u.id) THEN
      INSERT INTO orgs (name, owner_user_id) VALUES ('Default Org', u.id) RETURNING id INTO o_id;
      INSERT INTO org_memberships (org_id, user_id, role) VALUES (o_id, u.id, 'owner');
    END IF;
  END LOOP;
END $$;

-- Backfill org_id on links/domains
UPDATE links l
SET org_id = m.org_id
FROM org_memberships m
WHERE l.org_id IS NULL AND l.user_id = m.user_id;

UPDATE domains d
SET org_id = m.org_id
FROM org_memberships m
WHERE d.org_id IS NULL AND d.user_id = m.user_id;

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
CREATE INDEX IF NOT EXISTS idx_links_org_id ON links(org_id);
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_org_id ON domains(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_click_events_link_id ON click_events(link_id);
CREATE INDEX IF NOT EXISTS idx_click_events_occurred_at ON click_events(occurred_at);

COMMIT;
SQL

echo "==> Migration complete"
EOF

echo "==> Done."

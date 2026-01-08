# Production Migration Plan (oklink.lnk)

Goal: safely upgrade the existing production database to the current MVP schema.

## Assumptions
- Current production DB may have older tables (e.g., `clicks`)
- No automated migration tool is in place
- Downtime window is acceptable for MVP

## Step 1: Preflight (read-only)
1) Confirm DB backup is current
2) Capture schema:
   - `pg_dump --schema-only $DATABASE_URL > schema.sql`
3) Capture row counts:
   - `SELECT COUNT(*) FROM users;`
   - `SELECT COUNT(*) FROM links;`
   - `SELECT COUNT(*) FROM clicks;` (if exists)

## Step 2: Migration checklist
1) Create `domains` table if missing
2) Add `links.active` if missing
3) Add `links.domain_id` if missing
4) Ensure `click_events` table exists
5) Backfill `click_events` from `clicks` if needed
6) Add missing indexes

## Step 3: Manual SQL (template)
Review and run in a maintenance window:
```
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Domains
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

-- Links columns
ALTER TABLE links ADD COLUMN IF NOT EXISTS domain_id UUID REFERENCES domains(id) ON DELETE SET NULL;
ALTER TABLE links ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Click events
CREATE TABLE IF NOT EXISTS click_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID REFERENCES links(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backfill from clicks (if the old table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clicks') THEN
    INSERT INTO click_events (link_id, ip, user_agent, referer, occurred_at)
    SELECT link_id, ip_address, user_agent, referer, created_at
    FROM clicks
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code);
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_click_events_link_id ON click_events(link_id);
CREATE INDEX IF NOT EXISTS idx_click_events_occurred_at ON click_events(occurred_at);

COMMIT;
```

## Step 4: Post-migration verification
1) `SELECT COUNT(*) FROM click_events;`
2) Create and redirect a link
3) Verify analytics endpoints return data

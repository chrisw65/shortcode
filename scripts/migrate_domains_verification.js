require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

const sql = `
-- 1) domains table (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='domains') THEN
    CREATE TABLE public.domains (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      hostname VARCHAR(255) UNIQUE NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      is_verified BOOLEAN DEFAULT FALSE,
      verification_code VARCHAR(255),
      verification_method VARCHAR(50) DEFAULT 'dns_txt',
      verified_at TIMESTAMP,
      last_checked_at TIMESTAMP,
      failure_reason TEXT,
      ssl_enabled BOOLEAN DEFAULT FALSE,
      ssl_expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  END IF;
END $$;

-- 2) users.default_domain_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='default_domain_id') THEN
    ALTER TABLE users ADD COLUMN default_domain_id UUID REFERENCES domains(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) links.domain_id (nullable, used when a specific domain hosts a link)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='links' AND column_name='domain_id') THEN
    ALTER TABLE links ADD COLUMN domain_id UUID REFERENCES domains(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Helpful index
CREATE UNIQUE INDEX IF NOT EXISTS uq_domains_hostname ON domains(hostname);
`;

(async () => {
  try {
    console.log('Running domain schema migration...');
    await pool.query(sql);
    console.log('✓ Domain schema migration OK');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
})();


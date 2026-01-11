// scripts/migrate.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

const schema = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT true,
  is_superadmin BOOLEAN DEFAULT false,
  totp_secret TEXT,
  totp_enabled BOOLEAN DEFAULT false,
  totp_verified_at TIMESTAMP NULL,
  totp_last_used TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orgs table
CREATE TABLE IF NOT EXISTS orgs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_anonymization BOOLEAN DEFAULT false,
  data_retention_days INTEGER,
  api_rate_limit_rpm INTEGER,
  link_limit INTEGER,
  domain_limit INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Org memberships
CREATE TABLE IF NOT EXISTS org_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member', -- owner, admin, member
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (org_id, user_id)
);

-- Org SSO settings
CREATE TABLE IF NOT EXISTS org_sso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  provider VARCHAR(40) NOT NULL DEFAULT 'oidc',
  issuer_url TEXT,
  client_id TEXT,
  client_secret TEXT,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled BOOLEAN DEFAULT false,
  auto_provision BOOLEAN DEFAULT true,
  default_role VARCHAR(20) DEFAULT 'member',
  allowed_domains TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (org_id)
);

-- Org policy controls
CREATE TABLE IF NOT EXISTS org_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  require_sso BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (org_id)
);

-- API keys
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  prefix VARCHAR(32) NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['*']::text[],
  last_used_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (prefix)
);

-- Audit logs
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

-- User consents (terms, privacy, etc.)
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  consent_type VARCHAR(40) NOT NULL,
  version VARCHAR(40) NOT NULL,
  accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (user_id, consent_type, version)
);

-- Site settings (marketing/configurable content)
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Site settings history
CREATE TABLE IF NOT EXISTS site_settings_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_settings_history_key ON site_settings_history(key);
CREATE INDEX IF NOT EXISTS idx_site_settings_history_created ON site_settings_history(created_at);

-- Invites for org membership / referrals
CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  inviter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invitee_email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  token VARCHAR(128) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'sent', -- sent, accepted, expired, revoked
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  last_reminded_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS idx_invites_org_id ON invites(org_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(invitee_email);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_expires_at ON email_verification_tokens(expires_at);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires_at ON password_reset_tokens(expires_at);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invitee_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reward_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, granted, revoked
  reward_grant_id UUID NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_invitee ON referrals(invitee_user_id);

-- Plan grants (manual discounts / trial extensions)
CREATE TABLE IF NOT EXISTS plan_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type VARCHAR(20) NOT NULL, -- user, org
  target_id UUID NOT NULL,
  plan VARCHAR(50) NOT NULL,
  starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ends_at TIMESTAMP NOT NULL,
  reason TEXT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_plan_grants_target ON plan_grants(target_type, target_id);

-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  plan VARCHAR(50) NOT NULL,
  duration_months INTEGER NOT NULL DEFAULT 1,
  percent_off INTEGER NULL,
  max_redemptions INTEGER NULL,
  expires_at TIMESTAMP NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (coupon_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);

-- Affiliates
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  company VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, active, paused
  code VARCHAR(32) UNIQUE NOT NULL,
  payout_type VARCHAR(20) NOT NULL DEFAULT 'percent', -- percent, flat
  payout_rate NUMERIC(10,2) NOT NULL DEFAULT 30.00,
  password_hash VARCHAR(255),
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  org_id UUID REFERENCES orgs(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, paid, rejected
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_affiliate ON affiliate_conversions(affiliate_id);

CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, paid
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate ON affiliate_payouts(affiliate_id);

-- Billing (Stripe)
CREATE TABLE IF NOT EXISTS billing_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_billing_customers_org ON billing_customers(org_id);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_price_id VARCHAR(255),
  plan_id VARCHAR(50),
  status VARCHAR(40),
  current_period_end TIMESTAMP NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_org ON billing_subscriptions(org_id);

-- Domains table
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

-- Links table
CREATE TABLE IF NOT EXISTS links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
  short_code VARCHAR(64) UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  title VARCHAR(500),
  click_count BIGINT DEFAULT 0,
  password_hash VARCHAR(255),
  deep_link_url TEXT,
  ios_fallback_url TEXT,
  android_fallback_url TEXT,
  deep_link_enabled BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- Link variants (A/B routing)
CREATE TABLE IF NOT EXISTS link_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID REFERENCES links(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_link_variants_link_id ON link_variants(link_id);

-- Link routing rules (geo/device overrides)
CREATE TABLE IF NOT EXISTS link_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID REFERENCES links(id) ON DELETE CASCADE,
  rule_type VARCHAR(20) NOT NULL,
  rule_value VARCHAR(120) NOT NULL,
  destination_url TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_link_routes_link_id ON link_routes(link_id);
CREATE INDEX IF NOT EXISTS idx_link_routes_type ON link_routes(rule_type);

-- Link groups / campaigns
CREATE TABLE IF NOT EXISTS link_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (org_id, name)
);
CREATE INDEX IF NOT EXISTS idx_link_groups_org_id ON link_groups(org_id);

-- Link group membership (many-to-many)
CREATE TABLE IF NOT EXISTS link_group_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES link_groups(id) ON DELETE CASCADE,
  link_id UUID REFERENCES links(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (group_id, link_id)
);
CREATE INDEX IF NOT EXISTS idx_link_group_links_group ON link_group_links(group_id);
CREATE INDEX IF NOT EXISTS idx_link_group_links_link ON link_group_links(link_id);

-- Link tags
CREATE TABLE IF NOT EXISTS link_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  color VARCHAR(24),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (org_id, name)
);
CREATE INDEX IF NOT EXISTS idx_link_tags_org_id ON link_tags(org_id);

-- Link tag membership (many-to-many)
CREATE TABLE IF NOT EXISTS link_tag_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_id UUID REFERENCES link_tags(id) ON DELETE CASCADE,
  link_id UUID REFERENCES links(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tag_id, link_id)
);
CREATE INDEX IF NOT EXISTS idx_link_tag_links_tag ON link_tag_links(tag_id);
CREATE INDEX IF NOT EXISTS idx_link_tag_links_link ON link_tag_links(link_id);

-- Click events table
CREATE TABLE IF NOT EXISTS click_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID REFERENCES links(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  country_code VARCHAR(8),
  country_name VARCHAR(120),
  region VARCHAR(120),
  city VARCHAR(120),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE click_events ADD COLUMN IF NOT EXISTS country_code VARCHAR(8);
ALTER TABLE click_events ADD COLUMN IF NOT EXISTS country_name VARCHAR(120);
ALTER TABLE click_events ADD COLUMN IF NOT EXISTS region VARCHAR(120);
ALTER TABLE click_events ADD COLUMN IF NOT EXISTS city VARCHAR(120);
ALTER TABLE click_events ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6);
ALTER TABLE click_events ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT ARRAY['*']::text[];

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS ip_anonymization BOOLEAN DEFAULT false;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS api_rate_limit_rpm INTEGER;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS link_limit INTEGER;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS domain_limit INTEGER;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code);
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_links_org_id ON links(org_id);
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_org_id ON domains(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_click_events_link_id ON click_events(link_id);
CREATE INDEX IF NOT EXISTS idx_click_events_occurred_at ON click_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Backfill orgs and memberships for any users
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
`;

async function migrate() {
  try {
    console.log('Running database migrations...');
    await pool.query(schema);
    const seedEmail = process.env.SEED_ADMIN_EMAIL;
    const seedHash = process.env.SEED_ADMIN_PASSWORD_HASH;
    if (seedEmail && seedHash) {
      const seedName = process.env.SEED_ADMIN_NAME || 'Admin User';
      const seedPlan = process.env.SEED_ADMIN_PLAN || 'enterprise';
      await pool.query(
        `INSERT INTO users (email, password, name, plan, is_active, email_verified)
         VALUES ($1, $2, $3, $4, true, true)
         ON CONFLICT (email) DO NOTHING`,
        [seedEmail, seedHash, seedName, seedPlan]
      );
    }
    console.log('✓ Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();

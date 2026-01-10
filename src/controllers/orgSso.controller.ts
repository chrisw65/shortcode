import type { Response } from 'express';
import type { OrgRequest } from '../middleware/org';
import db from '../config/database';
import { logAudit } from '../services/audit';

const ALLOWED_PROVIDERS = new Set(['oidc']);
const ALLOWED_ROLES = new Set(['owner', 'admin', 'member']);

function normalizeScopes(input: unknown): string[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : String(input).split(',');
  return raw.map((s) => String(s).trim()).filter(Boolean);
}

function normalizeDomains(input: unknown): string[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : String(input).split(',');
  return raw.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
}

export async function getOrgSso(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const { rows } = await db.query(
      `SELECT id, provider, issuer_url, client_id, scopes, enabled, auto_provision, default_role, allowed_domains,
              created_at, updated_at
         FROM org_sso
        WHERE org_id = $1
        LIMIT 1`,
      [orgId]
    );
    if (!rows.length) {
      return res.json({
        success: true,
        data: {
          provider: 'oidc',
          scopes: [],
          enabled: false,
          auto_provision: true,
          default_role: 'member',
          allowed_domains: [],
          has_client_secret: false,
        },
      });
    }
    const row = rows[0];
    return res.json({
      success: true,
      data: {
        id: row.id,
        provider: row.provider,
        issuer_url: row.issuer_url,
        client_id: row.client_id,
        scopes: row.scopes || [],
        enabled: row.enabled,
        auto_provision: row.auto_provision !== false,
        default_role: row.default_role || 'member',
        allowed_domains: row.allowed_domains || [],
        created_at: row.created_at,
        updated_at: row.updated_at,
        has_client_secret: true,
      },
    });
  } catch (e) {
    console.error('getOrgSso error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateOrgSso(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org!.orgId;
    const actorId = req.user?.userId ?? null;
    const provider = String(req.body?.provider || 'oidc').trim().toLowerCase();
    const issuerUrl = String(req.body?.issuer_url || '').trim();
    const clientId = String(req.body?.client_id || '').trim();
    const clientSecret = String(req.body?.client_secret || '').trim();
    const scopes = normalizeScopes(req.body?.scopes);
    const enabled = Boolean(req.body?.enabled);
    const autoProvision = req.body?.auto_provision !== false;
    const defaultRole = String(req.body?.default_role || 'member').trim().toLowerCase();
    const allowedDomains = normalizeDomains(req.body?.allowed_domains);

    if (!ALLOWED_PROVIDERS.has(provider)) {
      return res.status(400).json({ success: false, error: 'Unsupported SSO provider' });
    }
    if (!ALLOWED_ROLES.has(defaultRole)) {
      return res.status(400).json({ success: false, error: 'default_role must be owner, admin, or member' });
    }
    if (enabled && (!issuerUrl || !clientId)) {
      return res.status(400).json({ success: false, error: 'issuer_url and client_id are required when enabled' });
    }
    if (!enabled) {
      const { rows: policyRows } = await db.query(
        `SELECT require_sso
           FROM org_policies
          WHERE org_id = $1
          LIMIT 1`,
        [orgId]
      );
      if (policyRows[0]?.require_sso) {
        return res.status(400).json({
          success: false,
          error: 'Disable the Require SSO policy before turning off SSO.',
        });
      }
    }

    const existing = await db.query(`SELECT id, client_secret FROM org_sso WHERE org_id = $1 LIMIT 1`, [orgId]);
    const secretToStore = clientSecret || existing.rows[0]?.client_secret || null;

    if (existing.rows.length) {
      const { rows } = await db.query(
        `UPDATE org_sso
            SET provider = $1,
                issuer_url = $2,
                client_id = $3,
                client_secret = $4,
                scopes = $5,
                enabled = $6,
                auto_provision = $7,
                default_role = $8,
                allowed_domains = $9,
                updated_at = NOW()
          WHERE org_id = $10
          RETURNING id, provider, issuer_url, client_id, scopes, enabled, auto_provision, default_role, allowed_domains,
                    created_at, updated_at`,
        [provider, issuerUrl, clientId, secretToStore, scopes, enabled, autoProvision, defaultRole, allowedDomains, orgId]
      );
      await logAudit({
        org_id: orgId,
        user_id: actorId,
        action: 'org.sso.update',
        entity_type: 'org_sso',
        entity_id: rows[0].id,
        metadata: {
          provider,
          issuer_url: issuerUrl,
          scopes,
          enabled,
          auto_provision: autoProvision,
          default_role: defaultRole,
          allowed_domains: allowedDomains,
          client_secret_updated: Boolean(clientSecret),
        },
      });
      return res.json({
        success: true,
        data: {
          ...rows[0],
          auto_provision: autoProvision,
          default_role: defaultRole,
          allowed_domains: allowedDomains,
          has_client_secret: Boolean(secretToStore),
        },
      });
    }

    const { rows } = await db.query(
      `INSERT INTO org_sso (org_id, provider, issuer_url, client_id, client_secret, scopes, enabled, auto_provision, default_role, allowed_domains)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, provider, issuer_url, client_id, scopes, enabled, auto_provision, default_role, allowed_domains,
                 created_at, updated_at`,
      [orgId, provider, issuerUrl, clientId, secretToStore, scopes, enabled, autoProvision, defaultRole, allowedDomains]
    );
    await logAudit({
      org_id: orgId,
      user_id: actorId,
      action: 'org.sso.create',
      entity_type: 'org_sso',
      entity_id: rows[0].id,
      metadata: {
        provider,
        issuer_url: issuerUrl,
        scopes,
        enabled,
        auto_provision: autoProvision,
        default_role: defaultRole,
        allowed_domains: allowedDomains,
        client_secret_updated: Boolean(secretToStore),
      },
    });
    return res.status(201).json({
      success: true,
      data: {
        ...rows[0],
        auto_provision: autoProvision,
        default_role: defaultRole,
        allowed_domains: allowedDomains,
        has_client_secret: Boolean(secretToStore),
      },
    });
  } catch (e) {
    console.error('updateOrgSso error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

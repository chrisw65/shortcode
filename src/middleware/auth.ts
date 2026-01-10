import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import db from '../config/database';

export type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    email?: string;
    role?: string;
    is_superadmin?: boolean;
  };
  apiKey?: {
    id: string;
    orgId: string;
    userId: string;
    name: string;
    prefix: string;
    scopes: string[];
  };
};

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  const apiKeyHeader = String(req.headers['x-api-key'] || '').trim();
  const apiKey = apiKeyHeader || (bearer.startsWith('sk_') ? bearer : '');
  const secret = process.env.JWT_SECRET;

  if (apiKey) {
    try {
      const hash = createHash('sha256').update(apiKey).digest('hex');
      const { rows } = await db.query(
        `SELECT id, org_id, user_id, name, prefix, scopes
           FROM api_keys
          WHERE key_hash = $1 AND revoked_at IS NULL
          LIMIT 1`,
        [hash]
      );
      if (!rows.length || !rows[0].user_id) {
        return res.status(401).json({ success: false, error: 'Invalid API key' });
      }
      await db.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [rows[0].id]);
      req.apiKey = {
        id: rows[0].id,
        orgId: rows[0].org_id,
        userId: rows[0].user_id,
        name: rows[0].name,
        prefix: rows[0].prefix,
        scopes: rows[0].scopes || ['*'],
      };
      req.user = { userId: rows[0].user_id };
      return next();
    } catch (err) {
      console.error('apiKey auth error:', err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  if (!bearer) {
    return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
  }

  if (!secret) {
    return res.status(500).json({ success: false, error: 'Server misconfigured: JWT_SECRET missing' });
  }

  try {
    const payload = jwt.verify(bearer, secret) as {
      userId: string;
      email?: string;
      role?: string;
      is_superadmin?: boolean;
    };

    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      is_superadmin: payload.is_superadmin,
    };

    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

export function requireSuperadmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user?.is_superadmin) {
    return res.status(403).json({ success: false, error: 'Superadmin access required' });
  }
  return next();
}

export type AffiliateRequest = Request & {
  affiliate?: {
    affiliateId: string;
    type?: string;
  };
};

export function authenticateAffiliate(req: AffiliateRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
  }

  const token = header.slice('Bearer '.length);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ success: false, error: 'Server misconfigured: JWT_SECRET missing' });
  }

  try {
    const payload = jwt.verify(token, secret) as { affiliateId?: string; type?: string };
    if (!payload.affiliateId || payload.type !== 'affiliate') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    req.affiliate = { affiliateId: payload.affiliateId, type: payload.type };
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

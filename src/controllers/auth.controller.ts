// src/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import db from '../config/database';

// ---- helpers ---------------------------------------------------------------

function safeUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    plan: row.plan ?? null,
    created_at: row.created_at ?? null,
    is_active: row.is_active ?? true,
    email_verified: row.email_verified ?? true,
    is_superadmin: row.is_superadmin ?? false,
  };
}

function signToken(payload: Record<string, any>) {
  const secret: Secret = process.env.JWT_SECRET as Secret;
  if (!secret) throw new Error('JWT_SECRET missing');

  // Infer the exact type jsonwebtoken expects
  const expiresIn: SignOptions['expiresIn'] = (() => {
    const expEnv = process.env.JWT_EXPIRES_IN;
    if (expEnv && /^\d+$/.test(expEnv)) return Number(expEnv); // seconds
    return (expEnv || '7d') as SignOptions['expiresIn'];       // ms-style string like '7d'
  })();

  const opts: SignOptions = { expiresIn };
  return jwt.sign(payload, secret, opts);
}

async function loginImpl(req: Request, res: Response) {
  try {
    const rawEmail = String(req.body?.email ?? '');
    const rawPass = String(req.body?.password ?? '');
    const email = rawEmail.replace(/\s+/g, '').trim().toLowerCase();

    if (!email || !rawPass) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const { rows } = await db.query(
      `SELECT id, email, name, plan, created_at, password AS password_hash,
              COALESCE(is_active, true)  AS is_active,
              COALESCE(email_verified, true) AS email_verified,
              COALESCE(is_superadmin, false) AS is_superadmin
         FROM users
        WHERE LOWER(email) = $1
        LIMIT 1`,
      [email]
    );

    const user = rows[0];
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    if (user.is_active === false) {
      return res.status(403).json({ success: false, error: 'Account disabled' });
    }

    // compare, with a guard for accidental leading/trailing spaces
    let ok = await bcrypt.compare(rawPass, user.password_hash);
    if (!ok && (/^\s/.test(rawPass) || /\s$/.test(rawPass))) {
      const trimmed = rawPass.trim();
      if (trimmed.length > 0) ok = await bcrypt.compare(trimmed, user.password_hash);
    }
    if (!ok) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const token = signToken({ userId: user.id, email: user.email, is_superadmin: user.is_superadmin });
    return res.json({ success: true, data: { user: safeUser(user), token } });
  } catch (err) {
    console.error('auth.login error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function registerImpl(req: Request, res: Response) {
  try {
    const email = String(req.body?.email ?? '').replace(/\s+/g, '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const name = (req.body?.name ?? null) as string | null;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const hash = await bcrypt.hash(password, 12);

    await db.query('BEGIN');

    const { rows } = await db.query(
      `INSERT INTO users (email, password, name, is_active, email_verified, is_superadmin)
       VALUES ($1, $2, $3, true, true, false)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, name, plan, created_at, password AS password_hash, is_active, email_verified, is_superadmin`,
      [email, hash, name]
    );

    const user = rows[0];
    if (!user) {
      await db.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'User already exists' });
    }

    const orgName = 'Default Org';
    const orgRes = await db.query(
      `INSERT INTO orgs (name, owner_user_id)
       VALUES ($1, $2)
       RETURNING id`,
      [orgName, user.id]
    );

    await db.query(
      `INSERT INTO org_memberships (org_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [orgRes.rows[0].id, user.id]
    );

    await db.query('COMMIT');

    const token = signToken({ userId: user.id, email: user.email, is_superadmin: user.is_superadmin });
    return res.status(201).json({
      success: true,
      data: { user: safeUser(user), token, org_id: orgRes.rows[0].id },
    });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch {}
    console.error('auth.register error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// Class export for existing routes
export class AuthController {
  login = (req: Request, res: Response) => { void loginImpl(req, res); };
  register = (req: Request, res: Response) => { void registerImpl(req, res); };
}

// Named exports (if used elsewhere)
export const login = (req: Request, res: Response) => { void loginImpl(req, res); };
export const register = (req: Request, res: Response) => { void registerImpl(req, res); };

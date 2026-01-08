import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    email?: string;
    role?: string;
    is_superadmin?: boolean;
  };
};

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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
    const payload = jwt.verify(token, secret) as {
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

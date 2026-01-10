import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';

function scopeMatches(granted: string, required: string) {
  if (granted === '*' || granted === required) return true;
  if (granted.endsWith(':*')) {
    const prefix = granted.slice(0, -2);
    return required.startsWith(`${prefix}:`);
  }
  return false;
}

export function requireApiScope(required: string | string[]) {
  const requiredScopes = Array.isArray(required) ? required : [required];
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) return next();
    const scopes = req.apiKey.scopes || [];
    const ok = requiredScopes.some((scope) => scopes.some((s) => scopeMatches(s, scope)));
    if (!ok) {
      return res.status(403).json({ success: false, error: 'API key scope not permitted' });
    }
    return next();
  };
}

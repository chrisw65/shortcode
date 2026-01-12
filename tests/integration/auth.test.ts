import request from 'supertest';
import jwt from 'jsonwebtoken';
import db from '../../src/config/database';
import { getEffectivePlan } from '../../src/services/plan';
import { getPlanEntitlements } from '../../src/services/entitlements';

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../../src/services/plan', () => ({
  getEffectivePlan: jest.fn(),
}));

jest.mock('../../src/services/entitlements', () => ({
  getPlanEntitlements: jest.fn(),
}));

process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_API_DISABLED = '1';
process.env.RATE_LIMIT_AUTH_DISABLED = '1';

import { app } from '../../src/index';

describe('auth integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
    (getEffectivePlan as jest.Mock).mockResolvedValue('pro');
    (getPlanEntitlements as jest.Mock).mockResolvedValue({
      features: { api_keys: true },
      limits: { links: 1000 },
    });
  });

  it('returns current user via /api/auth/me', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.includes('FROM users')) {
        return Promise.resolve({
          rows: [{
            id: 'user-1',
            email: 'test@example.com',
            name: 'Test User',
            plan: 'free',
            created_at: new Date().toISOString(),
            is_active: true,
            email_verified: true,
            is_superadmin: false,
            totp_enabled: false,
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1', email: 'test@example.com' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.user?.email).toBe('test@example.com');
    expect(res.body?.data?.org?.orgId).toBe('org-1');
    expect(getEffectivePlan).toHaveBeenCalled();
    expect(getPlanEntitlements).toHaveBeenCalled();
  });
});

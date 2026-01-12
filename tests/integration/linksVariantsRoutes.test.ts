import request from 'supertest';
import jwt from 'jsonwebtoken';
import db from '../../src/config/database';

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../../src/services/plan', () => ({
  getEffectivePlan: jest.fn().mockResolvedValue('pro'),
}));

jest.mock('../../src/services/entitlements', () => ({
  getPlanEntitlements: jest.fn(),
  isFeatureEnabled: (entitlements: any, key: string) => Boolean(entitlements?.features?.[key]),
}));

process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_API_DISABLED = '1';

import { app } from '../../src/index';
import { getPlanEntitlements } from '../../src/services/entitlements';

describe('links variants + routes integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
    (getPlanEntitlements as jest.Mock).mockReset();
  });

  it('blocks variants when entitlements are disabled', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { variants: false } });
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'admin' }] });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/links/abc123/variants')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('rejects invalid variant URLs', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { variants: true } });
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('FROM links')) {
        return Promise.resolve({ rows: [{ id: 'link-1' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/links/abc123/variants')
      .set('Authorization', `Bearer ${token}`)
      .send({ variants: [{ url: 'notaurl', weight: 50, active: true }] });

    expect(res.status).toBe(400);
  });

  it('blocks smart routes when entitlements are disabled', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { routes: false } });
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'admin' }] });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/links/abc123/routes')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('rejects invalid smart route types', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { routes: true } });
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('FROM links')) {
        return Promise.resolve({ rows: [{ id: 'link-1' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/links/abc123/routes')
      .set('Authorization', `Bearer ${token}`)
      .send({ routes: [{ type: 'region', value: 'US', destination_url: 'https://example.com', priority: 100, active: true }] });

    expect(res.status).toBe(400);
  });
});

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

describe('audit + api keys integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
    (getPlanEntitlements as jest.Mock).mockReset();
  });

  it('lists audit logs for org members', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'member' }] });
      }
      if (sql.includes('COUNT(*)') && sql.includes('FROM audit_logs')) {
        return Promise.resolve({ rows: [{ total: 1 }] });
      }
      if (sql.includes('FROM audit_logs')) {
        return Promise.resolve({ rows: [{ id: 'log-1', action: 'link.create', created_at: new Date().toISOString() }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.meta?.total).toBe(1);
  });

  it('exports audit logs as CSV', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'member' }] });
      }
      if (sql.includes('FROM audit_logs')) {
        return Promise.resolve({ rows: [{ id: 'log-1', action: 'link.create', created_at: new Date().toISOString() }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/audit/export')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('audit-logs.csv');
  });

  it('lists api keys when entitlements allow', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { api_keys: true } });
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('FROM api_keys')) {
        return Promise.resolve({ rows: [{ id: 'key-1', name: 'Primary' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/api-keys')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('creates api keys when entitlements allow', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { api_keys: true } });
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('INSERT INTO api_keys')) {
        return Promise.resolve({ rows: [{ id: 'key-1', name: 'Primary', prefix: 'abc', scopes: ['links:read'], created_at: new Date().toISOString() }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Primary', scopes: ['links:read'] });

    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.api_key).toContain('sk_live_');
  });

  it('revokes api keys when entitlements allow', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { api_keys: true } });
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('UPDATE api_keys')) {
        return Promise.resolve({ rows: [{ id: 'key-1', name: 'Primary', prefix: 'abc', revoked_at: new Date().toISOString() }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/api-keys/key-1/revoke')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });
});

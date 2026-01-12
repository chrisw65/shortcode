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

describe('tags and groups integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
    (getPlanEntitlements as jest.Mock).mockReset();
  });

  it('blocks tags when entitlements are disabled', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { tags: false } });
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'admin' }] });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/tags')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('lists tags when entitlements are enabled', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { tags: true } });
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('FROM link_tags')) {
        return Promise.resolve({ rows: [{ id: 'tag-1', name: 'Launch', color: '#fff' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/tags')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('blocks groups when entitlements are disabled', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { groups: false } });
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'admin' }] });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('lists groups when entitlements are enabled', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { groups: true } });
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('FROM link_groups')) {
        return Promise.resolve({ rows: [{ id: 'group-1', name: 'Campaigns' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/groups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });
});

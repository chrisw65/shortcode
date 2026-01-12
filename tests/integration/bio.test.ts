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

describe('bio pages integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
    (getPlanEntitlements as jest.Mock).mockReset();
  });

  it('blocks bio pages when entitlements are disabled', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { link_in_bio: false } });
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'admin' }] });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/bio')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('creates bio pages when entitlements are enabled', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { link_in_bio: true } });
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('INSERT INTO bio_pages')) {
        return Promise.resolve({ rows: [{ id: 'bio-1', slug: 'chris', title: 'Chris', is_active: true }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/bio')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'chris', title: 'Chris' });

    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
  });

  it('returns public bio JSON', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM bio_pages')) {
        return Promise.resolve({ rows: [{ id: 'bio-1', slug: 'chris', title: 'Chris', is_active: true }] });
      }
      if (sql.includes('FROM bio_links')) {
        return Promise.resolve({ rows: [{ id: 'link-1', label: 'Site', url: 'https://example.com' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app).get('/api/public/bio/chris');

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.slug).toBe('chris');
  });
});

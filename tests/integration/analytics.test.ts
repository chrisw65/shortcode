import request from 'supertest';
import jwt from 'jsonwebtoken';
import db from '../../src/config/database';
import redisClient from '../../src/config/redis';

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../../src/config/redis', () => ({
  __esModule: true,
  default: {
    isReady: false,
    get: jest.fn(),
    set: jest.fn(),
  },
}));

process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_API_DISABLED = '1';

import { app } from '../../src/index';

describe('analytics integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
    (redisClient.get as jest.Mock).mockReset();
    (redisClient.set as jest.Mock).mockReset();
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.includes('SELECT id, title FROM links')) {
        return Promise.resolve({ rows: [{ id: 'link-1', title: 'Example' }] });
      }
      if (sql.includes('SELECT id FROM links')) {
        return Promise.resolve({ rows: [{ id: 'link-1' }] });
      }
      if (sql.includes('generate_series')) {
        return Promise.resolve({ rows: [{ h: '2026-01-01T00:00:00Z', count: '2' }] });
      }
      if (sql.includes('total_clicks')) {
        return Promise.resolve({ rows: [{ total_clicks: '2', last_click_at: new Date().toISOString(), clicks_24h: '2' }] });
      }
      if (sql.includes('AS count')) {
        return Promise.resolve({ rows: [{ count: '2' }] });
      }
      if (sql.includes('AS referrer')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('user_agent AS ua')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('country_name')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('COALESCE(city')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('latitude')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
  });

  it('returns org summary with sparkline', async () => {
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/analytics/summary?range=24h')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.sparkline?.length).toBe(1);
  });

  it('returns link summary for a short code', async () => {
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/analytics/links/abc/summary?range=24h')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.sparkline?.length).toBe(1);
  });
});

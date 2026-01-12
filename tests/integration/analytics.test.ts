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
  });

  it('returns org summary with sparkline', async () => {
    (db.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ org_id: 'org-1', role: 'owner' }] }) // org membership
      .mockResolvedValueOnce({ rows: [{ h: '2026-01-01T00:00:00Z', count: '2' }] }) // series
      .mockResolvedValueOnce({ rows: [{ total_clicks: '2', last_click_at: new Date().toISOString(), clicks_24h: '2' }] }) // totals
      .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // range count
      .mockResolvedValueOnce({ rows: [] }) // referrers
      .mockResolvedValueOnce({ rows: [] }) // uas
      .mockResolvedValueOnce({ rows: [] }) // countries
      .mockResolvedValueOnce({ rows: [] }) // cities
      .mockResolvedValueOnce({ rows: [] }); // geo points

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/analytics/summary?range=24h')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.sparkline?.length).toBe(1);
  });
});

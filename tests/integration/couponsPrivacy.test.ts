import request from 'supertest';
import jwt from 'jsonwebtoken';
import db from '../../src/config/database';

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_API_DISABLED = '1';

import { app } from '../../src/index';

describe('coupons and privacy integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('requires auth to redeem coupons', async () => {
    const res = await request(app)
      .post('/api/coupons/redeem')
      .send({ code: 'TEST' });

    expect(res.status).toBe(401);
  });

  it('redeems a valid coupon', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM coupons')) {
        return Promise.resolve({
          rows: [{
            id: 'coupon-1',
            code: 'TEST',
            plan: 'pro',
            duration_months: 1,
            max_redemptions: null,
            expires_at: null,
            active: true,
          }],
        });
      }
      if (sql.includes('FROM coupon_redemptions')) {
        return Promise.resolve({ rows: [{ count: 0 }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/coupons/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TEST' });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('rejects expired coupons', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM coupons')) {
        return Promise.resolve({
          rows: [{
            id: 'coupon-1',
            code: 'TEST',
            plan: 'pro',
            duration_months: 1,
            expires_at: '2000-01-01T00:00:00.000Z',
            active: true,
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/coupons/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TEST' });

    expect(res.status).toBe(400);
  });

  it('exports user data for authenticated users', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM users')) {
        return Promise.resolve({ rows: [{ id: 'user-1', email: 'user@okleaf.link' }] });
      }
      if (sql.includes('FROM user_consents')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('FROM links')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('FROM domains')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('FROM api_keys')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/privacy/export')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('user-export.json');
  });
});

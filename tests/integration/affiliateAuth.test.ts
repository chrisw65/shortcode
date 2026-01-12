import request from 'supertest';
import jwt from 'jsonwebtoken';
import db from '../../src/config/database';

jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_API_DISABLED = '1';

import { app } from '../../src/index';

describe('affiliate auth integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('logs in active affiliates', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM affiliates')) {
        return Promise.resolve({
          rows: [{ id: 'aff-1', email: 'affiliate@okleaf.link', name: 'Partner', status: 'active', password_hash: 'hash' }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post('/api/affiliate/login')
      .send({ email: 'affiliate@okleaf.link', password: 'secret' });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.token).toBeTruthy();
  });

  it('returns affiliate profile with valid token', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'aff-1', name: 'Partner', email: 'affiliate@okleaf.link' }] });
    const token = jwt.sign({ affiliateId: 'aff-1', type: 'affiliate' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/affiliate/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('returns affiliate summary with valid token', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM affiliate_conversions')) {
        return Promise.resolve({ rows: [{ conversions: 2, total_amount: 120 }] });
      }
      if (sql.includes('FROM affiliate_payouts')) {
        return Promise.resolve({ rows: [{ pending_amount: 40 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const token = jwt.sign({ affiliateId: 'aff-1', type: 'affiliate' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/affiliate/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('returns affiliate conversions with valid token', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'conv-1' }] });
    const token = jwt.sign({ affiliateId: 'aff-1', type: 'affiliate' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/affiliate/conversions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('returns affiliate payouts with valid token', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'payout-1' }] });
    const token = jwt.sign({ affiliateId: 'aff-1', type: 'affiliate' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/affiliate/payouts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });
});

import request from 'supertest';
import jwt from 'jsonwebtoken';
import db from '../../src/config/database';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hash'),
}));

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_API_DISABLED = '1';

import { app } from '../../src/index';

describe('affiliates admin integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('lists affiliates for superadmin', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'aff-1', name: 'Partner' }] });
    const token = jwt.sign({ userId: 'user-1', is_superadmin: true }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/affiliates')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('creates affiliates for superadmin', async () => {
    (db.query as jest.Mock).mockResolvedValue({
      rows: [{
        id: 'aff-1',
        name: 'Partner',
        email: 'affiliate@okleaf.link',
        status: 'pending',
        code: 'CODE',
        payout_type: 'percent',
        payout_rate: 30,
        created_at: new Date().toISOString(),
      }],
    });
    const token = jwt.sign({ userId: 'user-1', is_superadmin: true }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/affiliates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Partner', email: 'affiliate@okleaf.link', payout_type: 'percent', payout_rate: 30 });

    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.temp_password).toBeTruthy();
  });

  it('lists affiliate payouts for superadmin', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'payout-1' }] });
    const token = jwt.sign({ userId: 'user-1', is_superadmin: true }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/affiliates/payouts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });
});

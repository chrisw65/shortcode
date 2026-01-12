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

describe('admin access integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('blocks non-superadmin from ecosystem config', async () => {
    const token = jwt.sign({ userId: 'user-1', is_superadmin: false }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/ecosystem')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('allows superadmin to read ecosystem config', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ value: { tools: { extension: { installLink: 'x' } } } }] });
    const token = jwt.sign({ userId: 'user-1', is_superadmin: true }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/ecosystem')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('allows superadmin to create coupons', async () => {
    (db.query as jest.Mock).mockResolvedValue({
      rows: [{
        id: 'coupon-1',
        code: 'TEST',
        plan: 'pro',
        duration_months: 1,
        percent_off: null,
        max_redemptions: null,
        expires_at: null,
        active: true,
        created_at: new Date().toISOString(),
      }],
    });
    const token = jwt.sign({ userId: 'user-1', is_superadmin: true }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/coupons')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'test', plan: 'pro', duration_months: 1 });

    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
  });

  it('blocks non-superadmin from coupons list', async () => {
    const token = jwt.sign({ userId: 'user-1', is_superadmin: false }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/coupons')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('blocks non-superadmin from plan grants list', async () => {
    const token = jwt.sign({ userId: 'user-1', is_superadmin: false }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/plan-grants')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('allows superadmin to create plan grants', async () => {
    (db.query as jest.Mock).mockResolvedValue({
      rows: [{
        id: 'grant-1',
        target_type: 'org',
        target_id: 'org-1',
        plan: 'enterprise',
        starts_at: new Date().toISOString(),
        ends_at: new Date().toISOString(),
        reason: 'manual_grant',
        created_at: new Date().toISOString(),
      }],
    });
    const token = jwt.sign({ userId: 'user-1', is_superadmin: true }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/plan-grants')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_type: 'org', target_id: 'org-1', plan: 'enterprise', duration_months: 12 });

    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
  });

  it('blocks non-superadmin from site config admin endpoints', async () => {
    const token = jwt.sign({ userId: 'user-1', is_superadmin: false }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/site-config')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('allows superadmin to read admin site config', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ value: { brand: { name: 'OkLeaf' } } }] });
    const token = jwt.sign({ userId: 'user-1', is_superadmin: true }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/site-config')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });
});

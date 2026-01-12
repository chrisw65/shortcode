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

describe('rbac integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'member' }] });
      }
      return Promise.resolve({ rows: [] });
    });
  });

  it('blocks member from creating links', async () => {
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/links')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(403);
  });

  it('blocks member from creating domains', async () => {
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/domains')
      .set('Authorization', `Bearer ${token}`)
      .send({ domain: 'example.com' });

    expect(res.status).toBe(403);
  });

  it('blocks member from inviting org members', async () => {
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/org/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'new@example.com', role: 'member' });

    expect(res.status).toBe(403);
  });

  it('blocks non-superadmin from billing config', async () => {
    const token = jwt.sign({ userId: 'user-1', is_superadmin: false }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/billing/config')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

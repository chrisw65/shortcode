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

describe('org members integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('lists org members for any role', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'member' }] });
      }
      if (sql.includes('FROM org_memberships m')) {
        return Promise.resolve({ rows: [{ id: 'member-1', email: 'test@example.com', role: 'member' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/org/members')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('allows owners to add members', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.includes('FROM users WHERE email')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('INSERT INTO users')) {
        return Promise.resolve({ rows: [{ id: 'user-2', email: 'new@example.com' }] });
      }
      if (sql.includes('INSERT INTO org_memberships')) {
        return Promise.resolve({ rows: [{ id: 'member-2', role: 'member' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/org/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'new@example.com', role: 'member' });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('blocks non-owners from removing members', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'admin' }] });
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .delete('/api/org/members/member-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

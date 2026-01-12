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

describe('domains advanced integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('sets default domain when verified', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('SELECT id, user_id, domain')) {
        return Promise.resolve({ rows: [{ id: 'dom-1', user_id: 'user-1', domain: 'example.com', is_active: true, verified: true }] });
      }
      if (sql.startsWith('UPDATE domains SET is_default = false')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('UPDATE domains') && sql.includes('RETURNING')) {
        return Promise.resolve({ rows: [{ id: 'dom-1', user_id: 'user-1', domain: 'example.com', is_default: true, is_active: true, verified: true }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/domains/dom-1/default')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('rejects setting default for unverified domains', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('SELECT id, user_id, domain')) {
        return Promise.resolve({ rows: [{ id: 'dom-1', user_id: 'user-1', domain: 'example.com', is_active: true, verified: false }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/domains/dom-1/default')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('deletes domains for owners', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.startsWith('DELETE FROM domains')) {
        return Promise.resolve({ rowCount: 1 });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .delete('/api/domains/dom-1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.data?.deleted).toBe(true);
  });
});

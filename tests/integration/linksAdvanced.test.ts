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

describe('links advanced integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('returns unavailable for invalid short codes', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'admin' }] });
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/links/availability/bad!!')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.data?.available).toBe(false);
  });

  it('returns unavailable when short code exists', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('FROM links') && sql.includes('LOWER(short_code)')) {
        return Promise.resolve({ rows: [{ id: 'link-1' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/links/availability/exists')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.data?.available).toBe(false);
  });

  it('returns core domain metadata', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'admin' }] });
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/links/core-domain')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.base_url).toBeTruthy();
  });

  it('updates link status when active is boolean', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('UPDATE links')) {
        return Promise.resolve({
          rows: [{
            id: 'link-1',
            user_id: 'user-1',
            short_code: 'abc123',
            original_url: 'https://example.com',
            title: null,
            click_count: 0,
            created_at: new Date().toISOString(),
            expires_at: null,
            active: false,
            domain: null,
            password_protected: false,
            deep_link_url: null,
            ios_fallback_url: null,
            android_fallback_url: null,
            deep_link_enabled: false,
            tags: [],
            groups: [],
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/links/abc123/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });
});

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

describe('links integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('lists links for the current org', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.includes('FROM links')) {
        return Promise.resolve({
          rows: [{
            id: 'link-1',
            user_id: 'user-1',
            short_code: 'abc',
            original_url: 'https://example.com',
            title: 'Example',
            click_count: 5,
            created_at: new Date().toISOString(),
            expires_at: null,
            active: true,
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

    const token = jwt.sign({ userId: 'user-1', email: 'test@example.com' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/links')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.length).toBe(1);
    expect(res.body?.data?.[0]?.short_code).toBe('abc');
  });
});

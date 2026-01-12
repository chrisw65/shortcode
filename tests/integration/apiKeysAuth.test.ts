import request from 'supertest';
import db from '../../src/config/database';
import { getOrgEntitlements } from '../../src/services/entitlements';

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../../src/services/entitlements', () => ({
  getOrgEntitlements: jest.fn(),
  isFeatureEnabled: jest.fn(() => true),
}));

process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_API_DISABLED = '1';

import { app } from '../../src/index';

describe('api key auth integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
    (getOrgEntitlements as jest.Mock).mockResolvedValue({
      features: { api_keys: true },
      limits: {},
    });
  });

  it('rejects when scope is missing', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM api_keys')) {
        return Promise.resolve({
          rows: [{
            id: 'key-1',
            org_id: 'org-1',
            user_id: 'user-1',
            name: 'Key',
            prefix: 'sk_live',
            scopes: ['links:read'],
          }],
        });
      }
      if (sql.includes('UPDATE api_keys')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post('/api/links')
      .set('Authorization', 'Bearer sk_live_fake')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(403);
    expect(res.body?.success).toBe(false);
  });

  it('accepts when scope is present', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM api_keys')) {
        return Promise.resolve({
          rows: [{
            id: 'key-1',
            org_id: 'org-1',
            user_id: 'user-1',
            name: 'Key',
            prefix: 'sk_live',
            scopes: ['links:write'],
          }],
        });
      }
      if (sql.includes('UPDATE api_keys')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT COUNT(*)')) {
        return Promise.resolve({ rows: [{ count: 0 }] });
      }
      if (sql.includes('INSERT INTO links')) {
        return Promise.resolve({
          rows: [{
            id: 'link-1',
            user_id: 'user-1',
            short_code: 'abc',
            original_url: 'https://example.com',
            title: null,
            click_count: 0,
            created_at: new Date().toISOString(),
            expires_at: null,
            active: true,
            domain: null,
            password_protected: false,
            deep_link_url: null,
            ios_fallback_url: null,
            android_fallback_url: null,
            deep_link_enabled: false,
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post('/api/links')
      .set('Authorization', 'Bearer sk_live_fake')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });
});

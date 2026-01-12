import request from 'supertest';
import jwt from 'jsonwebtoken';
import db from '../../src/config/database';
import * as dns from 'node:dns';
import { getEffectivePlan } from '../../src/services/plan';
import { getPlanEntitlements } from '../../src/services/entitlements';

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../../src/services/plan', () => ({
  getEffectivePlan: jest.fn(),
}));

jest.mock('../../src/services/entitlements', () => ({
  getPlanEntitlements: jest.fn(),
}));

jest.mock('node:dns', () => ({
  promises: {
    resolveTxt: jest.fn(),
    resolveCname: jest.fn(),
    resolve4: jest.fn(),
    resolve6: jest.fn(),
  },
}));

process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_API_DISABLED = '1';

import { app } from '../../src/index';

const dnsPromises = dns.promises as unknown as {
  resolveTxt: jest.Mock;
  resolveCname: jest.Mock;
  resolve4: jest.Mock;
  resolve6: jest.Mock;
};

describe('domains integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
    dnsPromises.resolveTxt.mockReset();
    dnsPromises.resolveCname.mockReset();
    dnsPromises.resolve4.mockReset();
    dnsPromises.resolve6.mockReset();
    (getEffectivePlan as jest.Mock).mockResolvedValue('pro');
    (getPlanEntitlements as jest.Mock).mockResolvedValue({
      features: { custom_domains: true },
      limits: { domains: 5 },
    });
  });

  it('verifies domain via TXT record', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.includes('SELECT id, user_id, domain')) {
        return Promise.resolve({
          rows: [{
            id: 'domain-1',
            user_id: 'user-1',
            domain: 'example.com',
            verification_token: 'token123',
          }],
        });
      }
      if (sql.includes('UPDATE domains')) {
        return Promise.resolve({
          rows: [{
            id: 'domain-1',
            user_id: 'user-1',
            domain: 'example.com',
            is_default: false,
            is_active: true,
            verified: true,
            verification_token: 'token123',
            verified_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    dnsPromises.resolveTxt.mockResolvedValueOnce([['token123']]);

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/domains/domain-1/verify')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.verified).toBe(true);
  });

  it('returns DNS check status', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.includes('SELECT id, user_id, domain')) {
        return Promise.resolve({
          rows: [{
            id: 'domain-2',
            user_id: 'user-1',
            domain: 'example.com',
            verification_token: 'token123',
            verified: false,
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    dnsPromises.resolveTxt.mockResolvedValueOnce([['token123']]);
    dnsPromises.resolveTxt.mockResolvedValueOnce([['shortlink-verify=token123']]);
    dnsPromises.resolveCname.mockResolvedValueOnce(['target.example.com']);
    dnsPromises.resolve4.mockResolvedValueOnce(['1.1.1.1']);
    dnsPromises.resolve6.mockResolvedValueOnce(['2606:4700:4700::1111']);

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/domains/domain-2/check')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.txt?.host_match).toBe(true);
    expect(res.body?.data?.a_records?.records?.length).toBe(1);
  });

  it('lists domains for the org', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.includes('FROM domains')) {
        return Promise.resolve({
          rows: [{
            id: 'domain-1',
            user_id: 'user-1',
            domain: 'example.com',
            is_default: true,
            is_active: true,
            verified: true,
            verification_token: 'token123',
            verified_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/domains')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.length).toBe(1);
  });

  it('creates a domain when plan allows', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.includes('SELECT COUNT(*)')) {
        return Promise.resolve({ rows: [{ count: 0 }] });
      }
      if (sql.includes('SELECT id, verification_token FROM domains')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('INSERT INTO domains')) {
        return Promise.resolve({
          rows: [{
            id: 'domain-3',
            user_id: 'user-1',
            domain: 'example.com',
            is_default: false,
            is_active: true,
            verified: false,
            verification_token: 'token123',
            verified_at: null,
            created_at: new Date().toISOString(),
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/domains')
      .set('Authorization', `Bearer ${token}`)
      .send({ domain: 'example.com', make_default: false });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.domain).toBe('example.com');
  });

  it('rejects domain creation when plan disallows', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({
      features: { custom_domains: false },
      limits: { domains: 0 },
    });

    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/domains')
      .set('Authorization', `Bearer ${token}`)
      .send({ domain: 'example.com', make_default: false });

    expect(res.status).toBe(403);
    expect(res.body?.success).toBe(false);
  });
});

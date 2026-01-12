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

describe('org SSO and policy integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('blocks members from updating SSO config', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'member' }] });
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/org/sso')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'oidc', issuer_url: 'https://issuer', client_id: 'client', enabled: true });

    expect(res.status).toBe(403);
  });

  it('allows admins to update SSO config', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('FROM org_policies')) {
        return Promise.resolve({ rows: [{ require_sso: false }] });
      }
      if (sql.includes('SELECT id, client_secret')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('INSERT INTO org_sso')) {
        return Promise.resolve({
          rows: [{
            id: 'sso-1',
            provider: 'oidc',
            issuer_url: 'https://issuer',
            client_id: 'client',
            scopes: [],
            enabled: true,
            auto_provision: true,
            default_role: 'member',
            allowed_domains: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/org/sso')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'oidc', issuer_url: 'https://issuer', client_id: 'client', enabled: true });

    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
  });

  it('prevents require_sso unless SSO is configured', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.includes('FROM org_sso')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/org/policy')
      .set('Authorization', `Bearer ${token}`)
      .send({ require_sso: true });

    expect(res.status).toBe(400);
    expect(res.body?.success).toBe(false);
  });

  it('allows require_sso when SSO is configured', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.includes('FROM org_sso')) {
        return Promise.resolve({ rows: [{ enabled: true, issuer_url: 'https://issuer', client_id: 'client' }] });
      }
      if (sql.includes('INSERT INTO org_policies')) {
        return Promise.resolve({
          rows: [{
            id: 'policy-1',
            require_sso: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/org/policy')
      .set('Authorization', `Bearer ${token}`)
      .send({ require_sso: true });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('returns default policy when none exists', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.includes('FROM org_policies')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/org/policy')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.require_sso).toBe(false);
  });

  it('returns default SSO config when none exists', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.includes('FROM org_sso')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/org/sso')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.provider).toBe('oidc');
  });

  it('rejects unsupported SSO provider', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'admin' }] });
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/org/sso')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'saml', issuer_url: 'https://issuer', client_id: 'client', enabled: true });

    expect(res.status).toBe(400);
    expect(res.body?.success).toBe(false);
  });

  it('rejects invalid default_role for SSO', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'admin' }] });
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/org/sso')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'oidc', default_role: 'superuser', enabled: false });

    expect(res.status).toBe(400);
    expect(res.body?.success).toBe(false);
  });

  it('rejects enabling SSO without issuer_url or client_id', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'admin' }] });
    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/org/sso')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'oidc', issuer_url: '', client_id: '', enabled: true });

    expect(res.status).toBe(400);
    expect(res.body?.success).toBe(false);
  });

  it('rejects disabling SSO while require_sso policy is active', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('FROM org_policies')) {
        return Promise.resolve({ rows: [{ require_sso: true }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/org/sso')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'oidc', enabled: false });

    expect(res.status).toBe(400);
    expect(res.body?.success).toBe(false);
  });

  it('rejects require_sso when SSO is disabled', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'owner' }] });
      }
      if (sql.includes('FROM org_sso')) {
        return Promise.resolve({ rows: [{ enabled: false, issuer_url: 'https://issuer', client_id: 'client' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/org/policy')
      .set('Authorization', `Bearer ${token}`)
      .send({ require_sso: true });

    expect(res.status).toBe(400);
    expect(res.body?.success).toBe(false);
  });
});

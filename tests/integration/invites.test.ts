import request from 'supertest';
import jwt from 'jsonwebtoken';
import db from '../../src/config/database';

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../../src/services/inviteEmails', () => ({
  sendInviteEmail: jest.fn().mockResolvedValue({ sent: true }),
}));

jest.mock('../../src/services/plan', () => ({
  getEffectivePlan: jest.fn().mockResolvedValue('pro'),
}));

jest.mock('../../src/services/entitlements', () => ({
  getPlanEntitlements: jest.fn().mockResolvedValue({ limits: {} }),
}));

process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_API_DISABLED = '1';

import { app } from '../../src/index';

describe('invites integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('blocks members from creating invites', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'member' }] });
    const token = jwt.sign({ userId: 'user-1', email: 'owner@okleaf.link' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/org/invites')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'new@okleaf.link', role: 'member' });

    expect(res.status).toBe(403);
  });

  it('allows admins to create invites', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('FROM org_memberships') && sql.includes('COUNT')) {
        return Promise.resolve({ rows: [{ count: 1 }] });
      }
      if (sql.includes('INSERT INTO invites')) {
        return Promise.resolve({
          rows: [{
            id: 'invite-1',
            invitee_email: 'new@okleaf.link',
            role: 'member',
            token: 'token',
            status: 'pending',
            created_at: new Date().toISOString(),
            expires_at: new Date().toISOString(),
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1', email: 'admin@okleaf.link' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/org/invites')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'new@okleaf.link', role: 'member' });

    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
  });

  it('lists invites for admins', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('FROM invites')) {
        return Promise.resolve({ rows: [{ id: 'invite-1' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1', email: 'admin@okleaf.link' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/org/invites')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });
});

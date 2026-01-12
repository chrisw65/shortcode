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

process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_API_DISABLED = '1';

import { app } from '../../src/index';

describe('invites advanced integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('revokes invites for admins', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ org_id: 'org-1', role: 'admin' }] });
    const token = jwt.sign({ userId: 'user-1', email: 'admin@okleaf.link' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/org/invites/invite-1/revoke')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('resends invites for admins', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('FROM invites') && sql.includes('SELECT invitee_email')) {
        return Promise.resolve({ rows: [{ invitee_email: 'new@okleaf.link', token: 'token' }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const token = jwt.sign({ userId: 'user-1', email: 'admin@okleaf.link' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/org/invites/invite-1/resend')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });
});

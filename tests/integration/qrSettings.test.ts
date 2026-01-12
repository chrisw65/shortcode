import request from 'supertest';
import jwt from 'jsonwebtoken';
import db from '../../src/config/database';

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../../src/services/plan', () => ({
  getEffectivePlan: jest.fn().mockResolvedValue('pro'),
}));

jest.mock('../../src/services/entitlements', () => ({
  getPlanEntitlements: jest.fn(),
  isFeatureEnabled: (entitlements: any, key: string) => Boolean(entitlements?.features?.[key]),
}));

process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_API_DISABLED = '1';

import { app } from '../../src/index';
import { getPlanEntitlements } from '../../src/services/entitlements';

describe('link QR settings integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
    (getPlanEntitlements as jest.Mock).mockReset();
  });

  it('rejects invalid QR colors', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { qr_customization: true } });
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('SELECT id FROM links')) {
        return Promise.resolve({ rows: [{ id: 'link-1' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/links/abc123/qr-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ color: 'red' });

    expect(res.status).toBe(400);
  });

  it('updates QR settings when valid', async () => {
    (getPlanEntitlements as jest.Mock).mockResolvedValue({ features: { qr_customization: true } });
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('SELECT id FROM links')) {
        return Promise.resolve({ rows: [{ id: 'link-1' }] });
      }
      if (sql.includes('INSERT INTO link_qr_settings')) {
        return Promise.resolve({ rows: [{ color: '#0b0d10', bg_color: '#ffffff', size: 256, margin: 1, error_correction: 'M', logo_url: null, logo_scale: 0.22 }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/links/abc123/qr-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ color: '#0b0d10', bg_color: '#ffffff', size: 256 });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });
});

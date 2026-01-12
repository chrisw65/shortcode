import request from 'supertest';
import db from '../../src/config/database';

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

process.env.RATE_LIMIT_API_DISABLED = '1';

import { app } from '../../src/index';

describe('platform config integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('returns default platform config when none stored', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/platform');

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.ui_mode).toBe('beginner');
  });

  it('rejects invalid retention_default_days', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });
    const res = await request(app)
      .put('/api/platform')
      .send({ retention_default_days: 0 });

    expect(res.status).toBe(400);
  });

  it('rejects invalid ui_mode', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });
    const res = await request(app)
      .put('/api/platform')
      .send({ ui_mode: 'advanced' });

    expect(res.status).toBe(400);
  });

  it('updates platform config when valid', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('SELECT value FROM site_settings')) {
        return Promise.resolve({ rows: [{ value: { retention_default_days: null, ui_mode: 'beginner' } }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const res = await request(app)
      .put('/api/platform')
      .send({ retention_default_days: 365, ui_mode: 'expert' });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.ui_mode).toBe('expert');
  });
});

import request from 'supertest';
import db from '../../src/config/database';

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

process.env.RATE_LIMIT_API_DISABLED = '1';

import { app } from '../../src/index';

describe('site public config integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('returns default site config when no settings exist', async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/public/site-config');

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.brand?.name).toBe('OkLeaf');
  });
});

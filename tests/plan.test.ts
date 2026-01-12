import db from '../src/config/database';
import { getEffectivePlan, getOrgPlan, isPaidPlan } from '../src/services/plan';

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('plan service', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('returns active grant for effective plan', async () => {
    (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ plan: 'pro' }] });
    const plan = await getEffectivePlan('user-1', 'org-1');
    expect(plan).toBe('pro');
  });

  it('falls back to user plan when no grant exists', async () => {
    (db.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ plan: 'starter' }] });
    const plan = await getEffectivePlan('user-1', 'org-1');
    expect(plan).toBe('starter');
  });

  it('returns org grant when present', async () => {
    (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ plan: 'enterprise' }] });
    const plan = await getOrgPlan('org-1');
    expect(plan).toBe('enterprise');
  });

  it('falls back to owner plan for orgs', async () => {
    (db.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ plan: 'free' }] });
    const plan = await getOrgPlan('org-1');
    expect(plan).toBe('free');
  });

  it('detects paid plans', () => {
    expect(isPaidPlan('free')).toBe(false);
    expect(isPaidPlan('pro')).toBe(true);
  });
});

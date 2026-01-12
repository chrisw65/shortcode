import db from '../src/config/database';
import { getPlanEntitlements, isFeatureEnabled } from '../src/services/entitlements';

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

describe('entitlements', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });
  });

  it('uses defaults when no overrides exist', async () => {
    const entitlements = await getPlanEntitlements('free');
    expect(entitlements.features.custom_domains).toBe(false);
    expect(entitlements.limits.links).toBe(10);
  });

  it('applies overrides and normalizes limits', async () => {
    (db.query as jest.Mock).mockResolvedValue({
      rows: [
        {
          value: {
            entitlements: {
              pro: {
                features: { webhooks: false },
                limits: { links: 0 },
              },
            },
          },
        },
      ],
    });
    const entitlements = await getPlanEntitlements('pro');
    expect(entitlements.features.webhooks).toBe(false);
    expect(entitlements.limits.links).toBeNull();
  });

  it('reports feature availability correctly', async () => {
    const entitlements = await getPlanEntitlements('starter');
    expect(isFeatureEnabled(entitlements, 'custom_domains')).toBe(true);
    expect(isFeatureEnabled(entitlements, 'variants')).toBe(false);
  });
});

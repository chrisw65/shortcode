import db from '../src/config/database';
import { getOrgLimits, clearOrgLimitCache } from '../src/services/orgLimits';
import { getOrgEntitlements } from '../src/services/entitlements';

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock('../src/services/entitlements', () => ({
  getOrgEntitlements: jest.fn(),
}));

describe('orgLimits', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });
    (getOrgEntitlements as jest.Mock).mockResolvedValue({
      limits: { api_rate_rpm: 300, links: 100, domains: 2 },
    });
    clearOrgLimitCache('org-1');
  });

  it('uses entitlements when org overrides are absent', async () => {
    const limits = await getOrgLimits('org-1');
    expect(limits.apiRateLimitRpm).toBe(300);
    expect(limits.linkLimit).toBe(100);
    expect(limits.domainLimit).toBe(2);
  });

  it('uses org overrides when provided', async () => {
    (db.query as jest.Mock).mockResolvedValue({
      rows: [{ api_rate_limit_rpm: 900, link_limit: 25, domain_limit: 1 }],
    });
    const limits = await getOrgLimits('org-1');
    expect(limits.apiRateLimitRpm).toBe(900);
    expect(limits.linkLimit).toBe(25);
    expect(limits.domainLimit).toBe(1);
  });

  it('caches limits per org', async () => {
    await getOrgLimits('org-1');
    await getOrgLimits('org-1');
    expect((db.query as jest.Mock).mock.calls.length).toBe(1);
  });
});

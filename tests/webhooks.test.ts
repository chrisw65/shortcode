import { emitWebhook } from '../src/services/webhooks';
import { getEcosystemConfig } from '../src/services/ecosystem.service';
import { getOrgEntitlements, isFeatureEnabled } from '../src/services/entitlements';

jest.mock('../src/services/ecosystem.service', () => ({
  getEcosystemConfig: jest.fn(),
}));

jest.mock('../src/services/entitlements', () => ({
  getOrgEntitlements: jest.fn(),
  isFeatureEnabled: jest.fn(),
}));

describe('webhooks', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    (getEcosystemConfig as jest.Mock).mockResolvedValue({
      webhooks: [{ id: 'link.created', enabled: true, url: 'https://example.com/hook' }],
    });
    (getOrgEntitlements as jest.Mock).mockResolvedValue({
      features: { webhooks: true },
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('skips delivery when org entitlement is disabled', async () => {
    const entitlements = { features: { webhooks: false } };
    (getOrgEntitlements as jest.Mock).mockResolvedValue(entitlements);
    (isFeatureEnabled as jest.Mock).mockReturnValue(false);
    await emitWebhook('link.created', { org_id: 'org-1' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('delivers enabled webhooks', async () => {
    (isFeatureEnabled as jest.Mock).mockReturnValue(true);
    await emitWebhook('link.created', { org_id: 'org-1', link_id: 'link-1' });
    await Promise.resolve();
    expect(global.fetch).toHaveBeenCalled();
  });
});

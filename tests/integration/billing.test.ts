import request from 'supertest';
import jwt from 'jsonwebtoken';
import db from '../../src/config/database';

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://stripe.test/checkout' }),
      },
    },
    billingPortal: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://stripe.test/portal' }),
      },
    },
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test' }),
    },
    subscriptions: {
      retrieve: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

process.env.JWT_SECRET = 'test-secret';
process.env.RATE_LIMIT_API_DISABLED = '1';

import { app } from '../../src/index';

const billingConfig = {
  stripe: {
    publishable_key: 'pk_test',
    secret_key: 'sk_test',
    webhook_secret: 'wh_test',
  },
  prices: {
    pro: { monthly: 'price_test' },
  },
  checkout: { success_url: 'https://okleaf.link/success', cancel_url: 'https://okleaf.link/cancel' },
  portal: { return_url: 'https://okleaf.link/portal' },
  entitlements: {},
};

describe('billing integration', () => {
  beforeEach(() => {
    (db.query as jest.Mock).mockReset();
  });

  it('allows superadmin to fetch billing config', async () => {
    (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ value: billingConfig }] });
    const token = jwt.sign({ userId: 'user-1', is_superadmin: true }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .get('/api/billing/config')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.stripe?.publishable_key).toBe('pk_test');
    expect(res.body?.data?.stripe?.has_secret_key).toBe(true);
    expect(res.body?.data?.stripe?.has_webhook_secret).toBe(true);
  });

  it('allows superadmin to update billing config', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('SELECT value FROM site_settings')) {
        return Promise.resolve({ rows: [{ value: billingConfig }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const token = jwt.sign({ userId: 'user-1', is_superadmin: true }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .put('/api/billing/config')
      .set('Authorization', `Bearer ${token}`)
      .send({ prices: { enterprise: { monthly: 'price_enterprise' } } });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('allows admins to create billing checkout sessions', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('SELECT value FROM site_settings')) {
        return Promise.resolve({ rows: [{ value: billingConfig }] });
      }
      if (sql.includes('FROM billing_customers')) {
        return Promise.resolve({ rows: [{ stripe_customer_id: 'cus_123' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan_id: 'pro', interval: 'monthly' });

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.url).toBe('https://stripe.test/checkout');
  });

  it('allows admins to create billing portal sessions', async () => {
    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FROM org_memberships')) {
        return Promise.resolve({ rows: [{ org_id: 'org-1', role: 'admin' }] });
      }
      if (sql.includes('SELECT value FROM site_settings')) {
        return Promise.resolve({ rows: [{ value: billingConfig }] });
      }
      if (sql.includes('FROM billing_customers')) {
        return Promise.resolve({ rows: [{ stripe_customer_id: 'cus_123' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const token = jwt.sign({ userId: 'user-1' }, process.env.JWT_SECRET as string);
    const res = await request(app)
      .post('/api/billing/portal')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.url).toBe('https://stripe.test/portal');
  });
});

// src/index.ts
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

// Routers
import authRoutes from './routes/auth.routes';
import linkRoutes from './routes/link.routes';
import domainRoutes from './routes/domain.routes';
import analyticsRoutes from './routes/analytics.routes';
import qrRoutes from './routes/qr.routes';
import redirectRoutes from './routes/redirect.routes';
import apiKeysRoutes from './routes/apiKeys.routes';
import orgRoutes from './routes/org.routes';
import orgsRoutes from './routes/orgs.routes';
import auditRoutes from './routes/audit.routes';
import privacyRoutes from './routes/privacy.routes';
import siteRoutes from './routes/site.routes';
import invitesRoutes from './routes/invites.routes';
import couponsRoutes from './routes/coupons.routes';
import planGrantsRoutes from './routes/planGrants.routes';
import affiliatesRoutes from './routes/affiliates.routes';
import affiliateAuthRoutes from './routes/affiliateAuth.routes';
import billingRoutes from './routes/billing.routes';
import openapiRoutes from './routes/openapi.routes';
import { stripeWebhook } from './controllers/billing.controller';
import redisClient from './config/redis';
import { startClickWorker } from './services/clickQueue';

// Ensure DB connects on boot (side-effect import if you have it)
import './config/database';

const app = express();

// If behind Cloudflare / a proxy
app.set('trust proxy', true);

// Security + basics
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
app.post('/api/v1/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  (req as any).id = randomUUID();
  res.setHeader('X-Request-Id', (req as any).id);
  next();
});
const morganFormat = ':remote-addr :method :url :status :res[content-length] - :response-time ms :req[x-request-id]';
app.use(morgan(morganFormat));

async function initRedis() {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    startClickWorker();
  } catch (err) {
    console.error('Redis init failed:', err);
  }
}
initRedis().catch(() => {});

// Serve static admin UI from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

// Serve favicon explicitly to avoid hitting redirect/rate-limit path
app.get('/favicon.ico', (_req, res) => {
  const iconPath = path.join(__dirname, '..', 'public', 'favicon.ico');
  if (fs.existsSync(iconPath)) {
    return res.sendFile(iconPath);
  }
  return res.status(204).end();
});

// API routes
const registerApi = (base: string) => {
  app.use(`${base}/auth`, authRoutes);
  app.use(`${base}/links`, linkRoutes);
  app.use(`${base}/domains`, domainRoutes);
  app.use(`${base}/analytics`, analyticsRoutes);
  app.use(`${base}/qr`, qrRoutes);
  app.use(`${base}/api-keys`, apiKeysRoutes);
  app.use(`${base}/org/invites`, invitesRoutes);
  app.use(`${base}/org`, orgRoutes);
  app.use(`${base}/orgs`, orgsRoutes);
  app.use(`${base}/org/audit`, auditRoutes);
  app.use(`${base}/privacy`, privacyRoutes);
  app.use(base, siteRoutes);
  app.use(`${base}/coupons`, couponsRoutes);
  app.use(`${base}/plan-grants`, planGrantsRoutes);
  app.use(`${base}/affiliates`, affiliatesRoutes);
  app.use(`${base}/affiliate`, affiliateAuthRoutes);
  app.use(`${base}/billing`, billingRoutes);
  app.use(base, openapiRoutes);
};

registerApi('/api');
registerApi('/api/v1');

// Public redirect route (must come AFTER /api and static so it doesn’t swallow them)
app.use('/', redirectRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  // JSON for API paths, basic text for others
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  return res.status(404).send('Not found');
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', { err, request_id: (req as any).id });
  if (res.headersSent) return;
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server (when run directly)
if (require.main === module) {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`✓ Server running on port ${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app;

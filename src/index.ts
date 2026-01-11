// src/index.ts
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { randomUUID, randomBytes } from 'crypto';
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
import tagsRoutes from './routes/tags.routes';
import groupsRoutes from './routes/groups.routes';
import siteRoutes from './routes/site.routes';
import invitesRoutes from './routes/invites.routes';
import couponsRoutes from './routes/coupons.routes';
import planGrantsRoutes from './routes/planGrants.routes';
import affiliatesRoutes from './routes/affiliates.routes';
import affiliateAuthRoutes from './routes/affiliateAuth.routes';
import billingRoutes from './routes/billing.routes';
import openapiRoutes from './routes/openapi.routes';
import platformRoutes from './routes/platform.routes';
import ecosystemRoutes from './routes/ecosystem.routes';
import { stripeWebhook } from './controllers/billing.controller';
import redisClient from './config/redis';
import { startClickWorker } from './services/clickQueue';
import { scheduleRetentionCleanup } from './services/retention';
import { log } from './utils/logger';

type RequestWithId = Request & { id?: string };

// Ensure DB connects on boot
import db from './config/database';

const modeRaw = String(process.env.SERVICE_MODE || 'all').toLowerCase();
const modeTokens = modeRaw.split(',').map((mode) => mode.trim()).filter(Boolean);
const modeSet = new Set(modeTokens.length ? modeTokens : ['all']);
const enableAll = modeSet.has('all');
const enableApi = enableAll || modeSet.has('api');
const enableRedirect = enableAll || modeSet.has('redirect');
const enableWorker = enableAll || modeSet.has('worker');
const enableStatic = enableApi;
const enableJobs = enableWorker || enableApi;

const app = express();
const LOG_FORMAT = String(process.env.LOG_FORMAT || 'json').toLowerCase();
const CSRF_COOKIE = 'csrf_token';

function isSecure(req: Request): boolean {
  if (req.secure) return true;
  const xfwd = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return xfwd.includes('https');
}

function parseCookies(header: string | undefined) {
  const out: Record<string, string> = {};
  const raw = header || '';
  raw.split(';').forEach((part) => {
    const [k, ...rest] = part.trim().split('=');
    if (!k) return;
    out[k] = decodeURIComponent(rest.join('='));
  });
  return out;
}

function appendCookie(res: Response, value: string) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', value);
    return;
  }
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, value]);
    return;
  }
  res.setHeader('Set-Cookie', [existing as string, value]);
}

function ensureCsrfCookie(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[CSRF_COOKIE]) return next();
  const token = randomBytes(32).toString('hex');
  const parts = [`${CSRF_COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'SameSite=Lax'];
  if (isSecure(req)) parts.push('Secure');
  appendCookie(res, parts.join('; '));
  return next();
}

function csrfProtect(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  if (req.path.startsWith('/api/billing/webhook') || req.path.startsWith('/api/v1/billing/webhook')) {
    return next();
  }
  const authHeader = String(req.headers.authorization || '');
  const apiKeyHeader = String(req.headers['x-api-key'] || '');
  if (authHeader || apiKeyHeader) return next();
  const cookies = parseCookies(req.headers.cookie);
  const csrfCookie = cookies[CSRF_COOKIE];
  const csrfHeader = String(req.headers['x-csrf-token'] || req.headers['x-xsrf-token'] || '');
  const csrfBody = String((req.body as any)?.csrf_token || (req.body as any)?._csrf || '');
  const provided = csrfHeader || csrfBody;
  if (!csrfCookie || !provided || csrfCookie !== provided) {
    return res.status(403).json({ success: false, error: 'Invalid CSRF token' });
  }
  return next();
}

// If behind Cloudflare / a proxy
app.set('trust proxy', true);

// Security + basics
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", 'https://challenges.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://challenges.cloudflare.com'],
      frameSrc: ["'self'", 'https://challenges.cloudflare.com'],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
}));
const normalizeOrigin = (raw: string | undefined | null) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  try {
    const url = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    return url.origin;
  } catch {
    return null;
  }
};
const corsEnv = String(process.env.CORS_ORIGINS || '').trim();
const inferredOrigins = [
  process.env.PUBLIC_HOST,
  process.env.BASE_URL,
  process.env.CORE_DOMAIN,
].filter(Boolean) as string[];
const originList = corsEnv ? corsEnv.split(',') : inferredOrigins;
const allowedOrigins = originList.map((o) => normalizeOrigin(o)).filter(Boolean) as string[];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalized = normalizeOrigin(origin);
      const ok = normalized ? allowedOrigins.includes(normalized) : false;
      return callback(null, ok);
    },
    credentials: true,
  })
);
if (enableApi) {
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
  app.post('/api/v1/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
} else if (enableRedirect) {
  app.use(express.urlencoded({ extended: false }));
}
app.use(ensureCsrfCookie);
app.use(csrfProtect);
app.use((req, res, next) => {
  const reqWithId = req as RequestWithId;
  reqWithId.id = randomUUID();
  res.setHeader('X-Request-Id', reqWithId.id);
  next();
});
const morganFormat = ':remote-addr :method :url :status :res[content-length] - :response-time ms :req[x-request-id]';
if (LOG_FORMAT === 'json') {
  app.use(morgan((tokens, req, res) => JSON.stringify({
    level: 'info',
    message: 'http_request',
    time: new Date().toISOString(),
    remote_addr: tokens['remote-addr'](req, res),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: Number(tokens.status(req, res)),
    content_length: tokens.res(req, res, 'content-length'),
    response_time_ms: Number(tokens['response-time'](req, res)),
    request_id: tokens.req(req, res, 'x-request-id'),
  })));
} else {
  app.use(morgan(morganFormat));
}

async function initRedis() {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    if (enableWorker) {
      startClickWorker();
    }
  } catch (err) {
    log('error', 'redis_init_failed', { error: String(err) });
  }
}
if (enableApi || enableRedirect || enableWorker) {
  initRedis().catch((err) => {
    log('warn', 'redis_init_deferred', { error: String(err) });
  });
}
if (enableJobs) {
  scheduleRetentionCleanup();
}

// Serve static admin UI from /public
if (enableStatic) {
  app.use(express.static(path.join(__dirname, '..', 'public')));
}

// Healthcheck
app.get('/health', async (_req, res) => {
  let dbOk = false;
  try {
    await db.query('SELECT 1');
    dbOk = true;
  } catch (err) {
    log('error', 'healthcheck_db_failed', { error: String(err) });
  }
  const redisOk = redisClient.isReady;
  const ok = dbOk;
  res.status(ok ? 200 : 503).json({
    ok,
    env: process.env.NODE_ENV || 'development',
    mode: modeRaw,
    db: dbOk,
    redis: redisOk,
  });
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
if (enableApi) {
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
    app.use(`${base}/tags`, tagsRoutes);
    app.use(`${base}/groups`, groupsRoutes);
    app.use(base, siteRoutes);
    app.use(`${base}/coupons`, couponsRoutes);
    app.use(`${base}/plan-grants`, planGrantsRoutes);
    app.use(`${base}/affiliates`, affiliatesRoutes);
    app.use(`${base}/affiliate`, affiliateAuthRoutes);
    app.use(`${base}/billing`, billingRoutes);
    app.use(`${base}/phase4/ecosystem`, ecosystemRoutes);
    app.use(`${base}/platform-config`, platformRoutes);
    app.use(base, openapiRoutes);
  };

  registerApi('/api');
  registerApi('/api/v1');
}

// Public redirect route (must come AFTER /api and static so it doesn’t swallow them)
if (enableRedirect) {
  app.use('/', redirectRoutes);
}

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
  const reqWithId = req as RequestWithId;
  log('error', 'unhandled_error', { error: String(err), request_id: reqWithId.id });
  if (res.headersSent) return;
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server (when run directly)
if (require.main === module && (enableApi || enableRedirect || enableStatic)) {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const server = app.listen(PORT, () => {
    log('info', 'server_started', {
      port: PORT,
      env: process.env.NODE_ENV || 'development',
      mode: modeRaw,
    });
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('info', 'shutdown_start', { signal });
    try {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    } catch (err) {
      log('error', 'shutdown_server_error', { error: String(err) });
    }
    try {
      if (redisClient.isOpen) await redisClient.quit();
    } catch (err) {
      log('error', 'shutdown_redis_error', { error: String(err) });
    }
    try {
      await db.end();
    } catch (err) {
      log('error', 'shutdown_db_error', { error: String(err) });
    }
    log('info', 'shutdown_complete');
    process.exit(0);
  };

  process.on('unhandledRejection', (reason) => {
    log('error', 'unhandled_rejection', { error: String(reason) });
  });
  process.on('uncaughtException', (err) => {
    log('error', 'uncaught_exception', { error: String(err) });
  });

  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
    process.on(signal, () => {
      void shutdown(signal);
    });
  });
}

export default app;

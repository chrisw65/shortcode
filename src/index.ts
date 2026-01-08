// src/index.ts
import 'dotenv/config';
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
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  (req as any).id = randomUUID();
  res.setHeader('X-Request-Id', (req as any).id);
  next();
});
const morganFormat = ':remote-addr :method :url :status :res[content-length] - :response-time ms :req[x-request-id]';
app.use(morgan(morganFormat));

// Serve static admin UI from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/api-keys', apiKeysRoutes);

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

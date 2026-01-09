// src/routes/openapi.routes.ts
import { Router } from 'express';

const router = Router();

router.get('/openapi.json', (_req, res) => {
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'OkLeaf API',
      version: 'v1',
      description: 'OkLeaf API for short links, domains, analytics, and org management.',
    },
    servers: [
      { url: '/api/v1', description: 'Versioned API' },
    ],
    paths: {
      '/auth/login': { post: { summary: 'Login' } },
      '/auth/register': { post: { summary: 'Register' } },
      '/links': { get: { summary: 'List links' }, post: { summary: 'Create link' } },
      '/links/{shortCode}': { get: { summary: 'Get link' }, put: { summary: 'Update link' }, delete: { summary: 'Delete link' } },
      '/links/availability/{shortCode}': { get: { summary: 'Check short code availability' } },
      '/domains': { get: { summary: 'List domains' }, post: { summary: 'Create domain' } },
      '/analytics/summary': { get: { summary: 'Analytics summary' } },
      '/org': { get: { summary: 'Get org' }, put: { summary: 'Update org' } },
      '/org/invites': { get: { summary: 'List invites' }, post: { summary: 'Create invite' } },
      '/api-keys': { get: { summary: 'List API keys' }, post: { summary: 'Create API key' } },
      '/qr': { get: { summary: 'Generate QR code' } },
    },
  });
});

export default router;

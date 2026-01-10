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
      '/auth/2fa/confirm': { post: { summary: 'Confirm 2FA login' } },
      '/auth/2fa/setup': { post: { summary: 'Start 2FA setup' } },
      '/auth/2fa/verify': { post: { summary: 'Verify 2FA setup' } },
      '/auth/2fa/disable': { post: { summary: 'Disable 2FA' } },
      '/links': { get: { summary: 'List links' }, post: { summary: 'Create link' } },
      '/links/bulk-create': { post: { summary: 'Bulk create links' } },
      '/links/bulk-delete': { post: { summary: 'Bulk delete links' } },
      '/links/bulk-import': { post: { summary: 'Bulk import links' } },
      '/links/{shortCode}': { get: { summary: 'Get link' }, put: { summary: 'Update link' }, delete: { summary: 'Delete link' } },
      '/links/{shortCode}/variants': { get: { summary: 'List link variants' }, put: { summary: 'Replace link variants' } },
      '/links/{shortCode}/routes': { get: { summary: 'List link routes' }, put: { summary: 'Replace link routes' } },
      '/links/availability/{shortCode}': { get: { summary: 'Check short code availability' } },
      '/tags': { get: { summary: 'List tags' }, post: { summary: 'Create tag' } },
      '/tags/{id}': { put: { summary: 'Update tag' }, delete: { summary: 'Delete tag' } },
      '/groups': { get: { summary: 'List groups' }, post: { summary: 'Create group' } },
      '/groups/{id}': { put: { summary: 'Update group' }, delete: { summary: 'Delete group' } },
      '/domains': { get: { summary: 'List domains' }, post: { summary: 'Create domain' } },
      '/analytics/summary': { get: { summary: 'Analytics summary' } },
      '/org': { get: { summary: 'Get org' }, put: { summary: 'Update org' } },
      '/org/invites': { get: { summary: 'List invites' }, post: { summary: 'Create invite' } },
      '/org/audit': { get: { summary: 'List audit logs' } },
      '/org/audit/export': { get: { summary: 'Export audit logs' } },
      '/api-keys': { get: { summary: 'List API keys' }, post: { summary: 'Create API key' } },
      '/platform-config': { get: { summary: 'Get platform config' }, put: { summary: 'Update platform config' } },
      '/qr': { get: { summary: 'Generate QR code' } },
      '/privacy/export': { get: { summary: 'Export user data' } },
      '/privacy/delete': { post: { summary: 'Delete user account' } },
      '/privacy/accept-terms': { post: { summary: 'Accept terms' } },
    },
  });
});

export default router;

// src/routes/webhooks.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg, requireOrgRole } from '../middleware/org';
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  listWebhookDeliveries,
} from '../controllers/webhooks.controller';

const router = Router();

router.get('/', authenticate, requireOrg, requireOrgRole(['owner', 'admin']), listWebhooks);
router.post('/', authenticate, requireOrg, requireOrgRole(['owner', 'admin']), createWebhook);
router.get('/deliveries', authenticate, requireOrg, requireOrgRole(['owner', 'admin']), listWebhookDeliveries);
router.patch('/:id', authenticate, requireOrg, requireOrgRole(['owner', 'admin']), updateWebhook);
router.delete('/:id', authenticate, requireOrg, requireOrgRole(['owner', 'admin']), deleteWebhook);
router.post('/:id/test', authenticate, requireOrg, requireOrgRole(['owner', 'admin']), testWebhook);

export default router;

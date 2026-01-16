// src/routes/webhooks.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg, requireOrgRole, requireActiveOrg } from '../middleware/org';
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  listWebhookDeliveries,
} from '../controllers/webhooks.controller';

const router = Router();

router.get('/', authenticate, requireOrg, requireActiveOrg, requireOrgRole(['owner', 'admin']), listWebhooks);
router.post('/', authenticate, requireOrg, requireActiveOrg, requireOrgRole(['owner', 'admin']), createWebhook);
router.get('/deliveries', authenticate, requireOrg, requireActiveOrg, requireOrgRole(['owner', 'admin']), listWebhookDeliveries);
router.patch('/:id', authenticate, requireOrg, requireActiveOrg, requireOrgRole(['owner', 'admin']), updateWebhook);
router.delete('/:id', authenticate, requireOrg, requireActiveOrg, requireOrgRole(['owner', 'admin']), deleteWebhook);
router.post('/:id/test', authenticate, requireOrg, requireActiveOrg, requireOrgRole(['owner', 'admin']), testWebhook);

export default router;

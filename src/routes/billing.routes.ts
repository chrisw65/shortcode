// src/routes/billing.routes.ts
import { Router, type RequestHandler } from 'express';
import { authenticate, requireSuperadmin } from '../middleware/auth';
import { requireOrg, requireOrgRole } from '../middleware/org';
import {
  getBillingConfig,
  updateBillingConfig,
  createCheckoutSession,
  createPortalSession,
} from '../controllers/billing.controller';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/config', authenticate, requireSuperadmin, wrap(getBillingConfig));
router.put('/config', authenticate, requireSuperadmin, wrap(updateBillingConfig));
router.post('/checkout', authenticate, requireOrg, requireOrgRole(['owner', 'admin']), wrap(createCheckoutSession));
router.post('/portal', authenticate, requireOrg, requireOrgRole(['owner', 'admin']), wrap(createPortalSession));

export default router;

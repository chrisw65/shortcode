// src/routes/domain.routes.ts
import { Router, type RequestHandler } from 'express';
import * as domainController from '../controllers/domain.controller';
import { authenticate } from '../middleware/auth';
import { requireOrg, requireOrgRole } from '../middleware/org';
import { perUser120rpm } from '../middleware/rateLimit';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);
router.use(requireOrg);
router.use(perUser120rpm);

router.get('/', wrap(domainController.listDomains));
router.post('/', wrap(domainController.createDomain));
router.post('/:id/verify', wrap(domainController.verifyDomain));
router.post('/:id/default', wrap(domainController.setDefaultDomain));
router.delete('/:id', requireOrgRole(['owner']), wrap(domainController.deleteDomain));

export default router;

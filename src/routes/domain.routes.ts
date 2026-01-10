// src/routes/domain.routes.ts
import { Router, type RequestHandler } from 'express';
import * as domainController from '../controllers/domain.controller';
import { authenticate } from '../middleware/auth';
import { requireOrg, requireOrgRole } from '../middleware/org';
import { perOrgApiRpmRedis } from '../middleware/redisRateLimit';
import { requireApiScope } from '../middleware/apiScope';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perOrgApiRpmRedis;

router.use(authenticate);
router.use(requireOrg);
router.use(apiLimiter);

router.get('/', requireApiScope('domains:read'), wrap(domainController.listDomains));
router.post('/', requireApiScope('domains:write'), wrap(domainController.createDomain));
router.post('/:id/verify', requireApiScope('domains:write'), wrap(domainController.verifyDomain));
router.post('/:id/default', requireApiScope('domains:write'), wrap(domainController.setDefaultDomain));
router.delete('/:id', requireApiScope('domains:write'), requireOrgRole(['owner']), wrap(domainController.deleteDomain));

export default router;

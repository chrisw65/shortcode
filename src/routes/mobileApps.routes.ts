import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg, requireActiveOrg } from '../middleware/org';
import { perOrgApiRpmRedis } from '../middleware/redisRateLimit';
import { requireApiScope } from '../middleware/apiScope';
import {
  listMobileApps,
  createMobileApp,
  updateMobileApp,
  deleteMobileApp,
} from '../controllers/mobileApps.controller';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perOrgApiRpmRedis;

router.use(authenticate);
router.use(requireOrg);
router.use(requireActiveOrg);
router.use(apiLimiter);

router.get('/', requireApiScope('mobile-apps:read'), wrap(listMobileApps));
router.post('/', requireApiScope('mobile-apps:write'), wrap(createMobileApp));
router.put('/:id', requireApiScope('mobile-apps:write'), wrap(updateMobileApp));
router.delete('/:id', requireApiScope('mobile-apps:write'), wrap(deleteMobileApp));

export default router;

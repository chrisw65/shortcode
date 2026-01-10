import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg, requireOrgRole } from '../middleware/org';
import { perUser120rpmRedis } from '../middleware/redisRateLimit';
import { listApiKeys, createApiKey, revokeApiKey } from '../controllers/apiKeys.controller';
import { requireApiScope } from '../middleware/apiScope';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perUser120rpmRedis;

router.use(authenticate);
router.use(requireOrg);
router.use(apiLimiter);
router.use(requireOrgRole(['owner', 'admin']));

router.get('/', requireApiScope('api-keys:read'), wrap(listApiKeys));
router.post('/', requireApiScope('api-keys:write'), wrap(createApiKey));
router.post('/:id/revoke', requireApiScope('api-keys:write'), wrap(revokeApiKey));

export default router;

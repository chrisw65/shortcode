import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg, requireOrgRole } from '../middleware/org';
import { perUser120rpmRedis } from '../middleware/redisRateLimit';
import { listApiKeys, createApiKey, revokeApiKey } from '../controllers/apiKeys.controller';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);
router.use(requireOrg);
router.use(perUser120rpmRedis);
router.use(requireOrgRole(['owner', 'admin']));

router.get('/', wrap(listApiKeys));
router.post('/', wrap(createApiKey));
router.post('/:id/revoke', wrap(revokeApiKey));

export default router;

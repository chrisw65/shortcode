import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg } from '../middleware/org';
import { perOrgApiRpmRedis } from '../middleware/redisRateLimit';
import { listGroups, createGroup, updateGroup, deleteGroup } from '../controllers/group.controller';
import { requireApiScope } from '../middleware/apiScope';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perOrgApiRpmRedis;

router.use(authenticate);
router.use(requireOrg);
router.use(apiLimiter);

router.get('/', requireApiScope('groups:read'), wrap(listGroups));
router.post('/', requireApiScope('groups:write'), wrap(createGroup));
router.put('/:id', requireApiScope('groups:write'), wrap(updateGroup));
router.delete('/:id', requireApiScope('groups:write'), wrap(deleteGroup));

export default router;

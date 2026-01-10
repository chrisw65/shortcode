import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg } from '../middleware/org';
import { perUser120rpmRedis } from '../middleware/redisRateLimit';
import { listGroups, createGroup, updateGroup, deleteGroup } from '../controllers/group.controller';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perUser120rpmRedis;

router.use(authenticate);
router.use(requireOrg);
router.use(apiLimiter);

router.get('/', wrap(listGroups));
router.post('/', wrap(createGroup));
router.put('/:id', wrap(updateGroup));
router.delete('/:id', wrap(deleteGroup));

export default router;

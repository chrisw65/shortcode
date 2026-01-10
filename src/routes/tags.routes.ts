import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg } from '../middleware/org';
import { perOrgApiRpmRedis } from '../middleware/redisRateLimit';
import { listTags, createTag, updateTag, deleteTag } from '../controllers/tag.controller';
import { requireApiScope } from '../middleware/apiScope';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perOrgApiRpmRedis;

router.use(authenticate);
router.use(requireOrg);
router.use(apiLimiter);

router.get('/', requireApiScope('tags:read'), wrap(listTags));
router.post('/', requireApiScope('tags:write'), wrap(createTag));
router.put('/:id', requireApiScope('tags:write'), wrap(updateTag));
router.delete('/:id', requireApiScope('tags:write'), wrap(deleteTag));

export default router;

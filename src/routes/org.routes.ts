import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg, requireOrgRole } from '../middleware/org';
import { perUser120rpmRedis } from '../middleware/redisRateLimit';
import { listMembers, addMember, removeMember } from '../controllers/org.controller';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perUser120rpmRedis;

router.use(authenticate);
router.use(requireOrg);
router.use(apiLimiter);

router.get('/members', wrap(listMembers));
router.post('/members', requireOrgRole(['owner']), wrap(addMember));
router.delete('/members/:memberId', requireOrgRole(['owner']), wrap(removeMember));

export default router;

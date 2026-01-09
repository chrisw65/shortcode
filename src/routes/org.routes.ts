import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg, requireOrgRole } from '../middleware/org';
import { perUser120rpmRedis } from '../middleware/redisRateLimit';
import { listMembers, addMember, removeMember } from '../controllers/org.controller';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);
router.use(requireOrg);
router.use(perUser120rpmRedis);

router.get('/members', wrap(listMembers));
router.post('/members', requireOrgRole(['owner']), wrap(addMember));
router.delete('/members/:memberId', requireOrgRole(['owner']), wrap(removeMember));

export default router;

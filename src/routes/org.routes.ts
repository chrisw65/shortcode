import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg, requireOrgRole } from '../middleware/org';
import { perOrgApiRpmRedis } from '../middleware/redisRateLimit';
import { listMembers, addMember, removeMember, getOrg, updateOrg } from '../controllers/org.controller';
import { getOrgSso, updateOrgSso } from '../controllers/orgSso.controller';
import { getOrgPolicy, updateOrgPolicy } from '../controllers/orgPolicy.controller';
import { requireApiScope } from '../middleware/apiScope';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perOrgApiRpmRedis;

router.use(authenticate);
router.use(requireOrg);
router.use(apiLimiter);

router.get('/', requireApiScope('org:read'), wrap(getOrg));
router.put('/', requireApiScope('org:write'), requireOrgRole(['owner', 'admin']), wrap(updateOrg));
router.get('/sso', requireApiScope('org:read'), requireOrgRole(['owner', 'admin']), wrap(getOrgSso));
router.put('/sso', requireApiScope('org:write'), requireOrgRole(['owner', 'admin']), wrap(updateOrgSso));
router.get('/policy', requireApiScope('org:read'), requireOrgRole(['owner', 'admin']), wrap(getOrgPolicy));
router.put('/policy', requireApiScope('org:write'), requireOrgRole(['owner', 'admin']), wrap(updateOrgPolicy));
router.get('/members', requireApiScope('org:read'), wrap(listMembers));
router.post('/members', requireApiScope('org:write'), requireOrgRole(['owner']), wrap(addMember));
router.delete('/members/:memberId', requireApiScope('org:write'), requireOrgRole(['owner']), wrap(removeMember));

export default router;

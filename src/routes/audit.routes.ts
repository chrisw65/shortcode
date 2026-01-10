import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg } from '../middleware/org';
import { perUser120rpmRedis } from '../middleware/redisRateLimit';
import { listAuditLogs, exportAuditLogs } from '../controllers/audit.controller';
import { requireApiScope } from '../middleware/apiScope';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perUser120rpmRedis;

router.use(authenticate);
router.use(requireOrg);
router.use(apiLimiter);

router.get('/', requireApiScope('audit:read'), wrap(listAuditLogs));
router.get('/export', requireApiScope('audit:read'), wrap(exportAuditLogs));

export default router;

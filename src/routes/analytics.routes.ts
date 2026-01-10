import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { summary, linkSummary, linkEvents, domainSummary, exportOrgCsv, exportLinkCsv } from '../controllers/analytics.controller';
import { perOrgApiRpmRedis } from '../middleware/redisRateLimit';
import { requireOrg } from '../middleware/org';
import { requireApiScope } from '../middleware/apiScope';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perOrgApiRpmRedis;

router.use(authenticate);
router.use(requireOrg);
router.use(apiLimiter);

router.get('/summary', requireApiScope('analytics:read'), wrap(summary));
router.get('/export', requireApiScope('analytics:read'), wrap(exportOrgCsv));
router.get('/links/:shortCode/summary', requireApiScope('analytics:read'), wrap(linkSummary));
router.get('/links/:shortCode/events', requireApiScope('analytics:read'), wrap(linkEvents));
router.get('/links/:shortCode/export', requireApiScope('analytics:read'), wrap(exportLinkCsv));
router.get('/domains/:id/summary', requireApiScope('analytics:read'), wrap(domainSummary));

export default router;

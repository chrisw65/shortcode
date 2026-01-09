import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { summary, linkSummary, linkEvents, domainSummary, exportOrgCsv, exportLinkCsv } from '../controllers/analytics.controller';
import { perUser120rpmRedis } from '../middleware/redisRateLimit';
import { requireOrg } from '../middleware/org';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perUser120rpmRedis;

router.use(authenticate);
router.use(requireOrg);
router.use(apiLimiter);

router.get('/summary', wrap(summary));
router.get('/export', wrap(exportOrgCsv));
router.get('/links/:shortCode/summary', wrap(linkSummary));
router.get('/links/:shortCode/events', wrap(linkEvents));
router.get('/links/:shortCode/export', wrap(exportLinkCsv));
router.get('/domains/:id/summary', wrap(domainSummary));

export default router;

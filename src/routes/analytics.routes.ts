import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { summary, linkSummary, linkEvents } from '../controllers/analytics.controller';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);

router.get('/summary', wrap(summary));
router.get('/links/:shortCode/summary', wrap(linkSummary));
router.get('/links/:shortCode/events', wrap(linkEvents));

export default router;



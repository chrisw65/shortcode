import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { perUser120rpmRedis } from '../middleware/redisRateLimit';
import { exportUserData, deleteUser, acceptTerms } from '../controllers/privacy.controller';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perUser120rpmRedis;

router.use(authenticate);
router.use(apiLimiter);

router.get('/export', wrap(exportUserData));
router.post('/delete', wrap(deleteUser));
router.post('/accept-terms', wrap(acceptTerms));

export default router;

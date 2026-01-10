import { Router, type RequestHandler } from 'express';
import { authenticate, requireSuperadmin } from '../middleware/auth';
import { getPlatformConfig, updatePlatformConfig } from '../controllers/platform.controller';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);
router.use(requireSuperadmin);

router.get('/', wrap(getPlatformConfig));
router.put('/', wrap(updatePlatformConfig));

export default router;

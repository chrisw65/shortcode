// src/routes/redirect.routes.ts
import { Router } from 'express';
import { RedirectController } from '../controllers/redirect.controller';
import { perIpRedirectRpmRedis } from '../middleware/redisRateLimit';

const router = Router();
const redirectController = new RedirectController();

const noLimit = (_req: any, _res: any, next: any) => next();
const redirectLimiter = process.env.RATE_LIMIT_REDIRECT_DISABLED === '1'
  ? noLimit
  : perIpRedirectRpmRedis;

router.get('/:shortCode', redirectLimiter, redirectController.redirect);
router.post('/:shortCode', redirectLimiter, redirectController.redirect);

export default router;

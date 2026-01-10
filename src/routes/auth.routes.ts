// src/routes/auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { perAuth300rpmRedis } from '../middleware/redisRateLimit';
import { authenticate } from '../middleware/auth';
import { requireOrg } from '../middleware/org';

const router = Router();
const authController = new AuthController();

const authLimiter = process.env.RATE_LIMIT_AUTH_DISABLED === '1'
  ? ((_req: any, _res: any, next: any) => next())
  : perAuth300rpmRedis;

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/oidc/start', authLimiter, authController.oidcStart);
router.get('/oidc/callback', authLimiter, authController.oidcCallback);
router.get('/me', authenticate, requireOrg, authController.me);
router.post('/change-password', authenticate, authController.changePassword);

export default router;

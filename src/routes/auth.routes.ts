// src/routes/auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { perIp60rpmRedis } from '../middleware/redisRateLimit';
import { authenticate } from '../middleware/auth';
import { requireOrg } from '../middleware/org';

const router = Router();
const authController = new AuthController();

router.post('/register', perIp60rpmRedis, authController.register);
router.post('/login', perIp60rpmRedis, authController.login);
router.get('/me', authenticate, requireOrg, authController.me);
router.post('/change-password', authenticate, authController.changePassword);

export default router;

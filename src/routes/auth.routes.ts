// src/routes/auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { perIp60rpm } from '../middleware/rateLimit';
import { authenticate } from '../middleware/auth';
import { requireOrg } from '../middleware/org';

const router = Router();
const authController = new AuthController();

router.post('/register', perIp60rpm, authController.register);
router.post('/login', perIp60rpm, authController.login);
router.get('/me', authenticate, requireOrg, authController.me);
router.post('/change-password', authenticate, authController.changePassword);

export default router;

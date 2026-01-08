// src/routes/auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { perIp60rpm } from '../middleware/rateLimit';

const router = Router();
const authController = new AuthController();

router.post('/register', perIp60rpm, authController.register);
router.post('/login', perIp60rpm, authController.login);

export default router;

// src/routes/redirect.routes.ts
import { Router } from 'express';
import { RedirectController } from '../controllers/redirect.controller';
import { perIp600rpmRedis } from '../middleware/redisRateLimit';

const router = Router();
const redirectController = new RedirectController();

router.get('/:shortCode', perIp600rpmRedis, redirectController.redirect);

export default router;

// src/routes/redirect.routes.ts
import { Router } from 'express';
import { RedirectController } from '../controllers/redirect.controller';
import { perIp600rpm } from '../middleware/rateLimit';

const router = Router();
const redirectController = new RedirectController();

router.get('/:shortCode', perIp600rpm, redirectController.redirect);

export default router;

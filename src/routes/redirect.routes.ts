// src/routes/redirect.routes.ts
import { Router } from 'express';
import { RedirectController } from '../controllers/redirect.controller';

const router = Router();
const redirectController = new RedirectController();

router.get('/:shortCode', redirectController.redirect);

export default router;

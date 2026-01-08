// src/routes/planGrants.routes.ts
import { Router } from 'express';
import { authenticate, requireSuperadmin } from '../middleware/auth';
import { createPlanGrant, listPlanGrants } from '../controllers/planGrants.controller';

const router = Router();

router.get('/', authenticate, requireSuperadmin, listPlanGrants);
router.post('/', authenticate, requireSuperadmin, createPlanGrant);

export default router;

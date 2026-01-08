// src/routes/affiliates.routes.ts
import { Router } from 'express';
import { authenticate, requireSuperadmin } from '../middleware/auth';
import {
  listAffiliates,
  createAffiliate,
  updateAffiliate,
  listAffiliatePayouts,
  createAffiliatePayout,
  updateAffiliatePayout,
} from '../controllers/affiliates.controller';

const router = Router();

router.get('/', authenticate, requireSuperadmin, listAffiliates);
router.post('/', authenticate, requireSuperadmin, createAffiliate);
router.patch('/:id', authenticate, requireSuperadmin, updateAffiliate);
router.get('/payouts', authenticate, requireSuperadmin, listAffiliatePayouts);
router.post('/payouts', authenticate, requireSuperadmin, createAffiliatePayout);
router.patch('/payouts/:id', authenticate, requireSuperadmin, updateAffiliatePayout);

export default router;

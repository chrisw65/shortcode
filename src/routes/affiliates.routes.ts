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
  getAffiliateConfigAdmin,
  updateAffiliateConfigAdmin,
} from '../controllers/affiliates.controller';

const router = Router();

router.get('/', authenticate, requireSuperadmin, listAffiliates);
router.get('/config', authenticate, requireSuperadmin, getAffiliateConfigAdmin);
router.put('/config', authenticate, requireSuperadmin, updateAffiliateConfigAdmin);
router.post('/', authenticate, requireSuperadmin, createAffiliate);
router.get('/payouts', authenticate, requireSuperadmin, listAffiliatePayouts);
router.post('/payouts', authenticate, requireSuperadmin, createAffiliatePayout);
router.patch('/payouts/:id', authenticate, requireSuperadmin, updateAffiliatePayout);
router.patch('/:id', authenticate, requireSuperadmin, updateAffiliate);

export default router;

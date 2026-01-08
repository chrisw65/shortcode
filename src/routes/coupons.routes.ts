// src/routes/coupons.routes.ts
import { Router } from 'express';
import { authenticate, requireSuperadmin } from '../middleware/auth';
import { createCoupon, listCoupons, redeemCoupon } from '../controllers/coupons.controller';

const router = Router();

router.get('/', authenticate, requireSuperadmin, listCoupons);
router.post('/', authenticate, requireSuperadmin, createCoupon);
router.post('/redeem', authenticate, redeemCoupon);

export default router;

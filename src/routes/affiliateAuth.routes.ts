// src/routes/affiliateAuth.routes.ts
import { Router } from 'express';
import {
  affiliateLogin,
  affiliateMe,
  affiliateSummary,
  affiliateConversions,
  affiliatePayouts,
  affiliateConfig,
  affiliateCoupons,
  createAffiliateCoupon,
} from '../controllers/affiliateAuth.controller';
import { authenticateAffiliate } from '../middleware/auth';

const router = Router();

router.post('/login', affiliateLogin);
router.get('/me', authenticateAffiliate, affiliateMe);
router.get('/config', authenticateAffiliate, affiliateConfig);
router.get('/summary', authenticateAffiliate, affiliateSummary);
router.get('/conversions', authenticateAffiliate, affiliateConversions);
router.get('/payouts', authenticateAffiliate, affiliatePayouts);
router.get('/coupons', authenticateAffiliate, affiliateCoupons);
router.post('/coupons', authenticateAffiliate, createAffiliateCoupon);

export default router;

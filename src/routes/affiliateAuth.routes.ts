// src/routes/affiliateAuth.routes.ts
import { Router } from 'express';
import { affiliateLogin, affiliateMe, affiliateSummary, affiliateConversions, affiliatePayouts } from '../controllers/affiliateAuth.controller';
import { authenticateAffiliate } from '../middleware/auth';

const router = Router();

router.post('/login', affiliateLogin);
router.get('/me', authenticateAffiliate, affiliateMe);
router.get('/summary', authenticateAffiliate, affiliateSummary);
router.get('/conversions', authenticateAffiliate, affiliateConversions);
router.get('/payouts', authenticateAffiliate, affiliatePayouts);

export default router;

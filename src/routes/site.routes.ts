// src/routes/site.routes.ts
import { Router } from 'express';
import { authenticate, requireSuperadmin } from '../middleware/auth';
import { perIp20rpmRedis } from '../middleware/redisRateLimit';
import {
  getAdminSiteConfig,
  getPublicSiteConfig,
  updateSiteConfig,
  publishSiteConfig,
  syncSiteConfigDefaults,
  getSiteHistory,
  rollbackSiteConfig,
  sendSiteEmailTest,
  sendContactMessage,
} from '../controllers/site.controller';

const router = Router();

router.get('/public/site-config', getPublicSiteConfig);
router.post('/public/contact', perIp20rpmRedis, sendContactMessage);
router.get('/site-config', authenticate, requireSuperadmin, getAdminSiteConfig);
router.put('/site-config', authenticate, requireSuperadmin, updateSiteConfig);
router.post('/site-config/publish', authenticate, requireSuperadmin, publishSiteConfig);
router.post('/site-config/sync-defaults', authenticate, requireSuperadmin, syncSiteConfigDefaults);
router.get('/site-config/history', authenticate, requireSuperadmin, getSiteHistory);
router.post('/site-config/rollback', authenticate, requireSuperadmin, rollbackSiteConfig);
router.post('/site-config/email-test', authenticate, requireSuperadmin, sendSiteEmailTest);

export default router;

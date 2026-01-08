// src/routes/site.routes.ts
import { Router } from 'express';
import { authenticate, requireSuperadmin } from '../middleware/auth';
import {
  getAdminSiteConfig,
  getPublicSiteConfig,
  updateSiteConfig,
  publishSiteConfig,
  getSiteHistory,
  rollbackSiteConfig,
} from '../controllers/site.controller';

const router = Router();

router.get('/public/site-config', getPublicSiteConfig);
router.get('/site-config', authenticate, requireSuperadmin, getAdminSiteConfig);
router.put('/site-config', authenticate, requireSuperadmin, updateSiteConfig);
router.post('/site-config/publish', authenticate, requireSuperadmin, publishSiteConfig);
router.get('/site-config/history', authenticate, requireSuperadmin, getSiteHistory);
router.post('/site-config/rollback', authenticate, requireSuperadmin, rollbackSiteConfig);

export default router;

// src/routes/link.routes.ts
import { Router, type RequestHandler } from 'express';
import * as linkController from '../controllers/link.controller';
import { authenticate } from '../middleware/auth';
import { requireOrg } from '../middleware/org';
import { perUser120rpmRedis } from '../middleware/redisRateLimit';
import { requireApiScope } from '../middleware/apiScope';

const router = Router();

// tiny async wrapper so unhandled rejections don’t crash the process
const wrap = (fn: any): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perUser120rpmRedis;

// All link endpoints require auth
router.use(authenticate);
router.use(requireOrg);
router.use(apiLimiter);

// Create a new short link
router.post('/', requireApiScope('links:write'), wrap(linkController.createLink));

// Bulk operations
router.post('/bulk-create', requireApiScope('links:write'), wrap(linkController.bulkCreateLinks));
router.post('/bulk-delete', requireApiScope('links:write'), wrap(linkController.bulkDeleteLinks));
router.post('/bulk-import', requireApiScope('links:write'), wrap(linkController.bulkImportLinks));

// Check short code availability
router.get('/availability/:shortCode', requireApiScope('links:read'), wrap(linkController.checkAvailability));

// Core domain (okleaf.lnk)
router.get('/core-domain', requireApiScope('links:read'), wrap(linkController.getCoreDomain));

// List current user's links
router.get('/', requireApiScope('links:read'), wrap(linkController.getUserLinks));

// Manage link variants
router.get('/:shortCode/variants', requireApiScope('links:read'), wrap(linkController.listVariants));
router.put('/:shortCode/variants', requireApiScope('links:write'), wrap(linkController.replaceVariants));

// Get a single link (by short code, owned by the user)
router.get('/:shortCode', requireApiScope('links:read'), wrap(linkController.getLinkDetails));

// Update a link (title/url/expiry) by short code
router.put('/:shortCode', requireApiScope('links:write'), wrap(linkController.updateLink));

// Delete a link by short code
router.delete('/:shortCode', requireApiScope('links:write'), wrap(linkController.deleteLink));

export default router;

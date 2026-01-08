// src/routes/link.routes.ts
import { Router, type RequestHandler } from 'express';
import * as linkController from '../controllers/link.controller';
import { authenticate } from '../middleware/auth';
import { requireOrg } from '../middleware/org';
import { perUser120rpm } from '../middleware/rateLimit';

const router = Router();

// tiny async wrapper so unhandled rejections don’t crash the process
const wrap = (fn: any): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// All link endpoints require auth
router.use(authenticate);
router.use(requireOrg);
router.use(perUser120rpm);

// Create a new short link
router.post('/', wrap(linkController.createLink));

// Check short code availability
router.get('/availability/:shortCode', wrap(linkController.checkAvailability));

// Core domain (okleaf.lnk)
router.get('/core-domain', wrap(linkController.getCoreDomain));

// List current user's links
router.get('/', wrap(linkController.getUserLinks));

// Get a single link (by short code, owned by the user)
router.get('/:shortCode', wrap(linkController.getLinkDetails));

// Update a link (title/url/expiry) by short code
router.put('/:shortCode', wrap(linkController.updateLink));

// Delete a link by short code
router.delete('/:shortCode', wrap(linkController.deleteLink));

export default router;

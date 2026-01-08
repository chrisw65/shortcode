// src/routes/invites.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg, requireOrgRole } from '../middleware/org';
import { createInvite, listInvites, revokeInvite, resendInvite } from '../controllers/invites.controller';

const router = Router();

router.get('/', authenticate, requireOrg, requireOrgRole(['admin', 'owner']), listInvites);
router.post('/', authenticate, requireOrg, requireOrgRole(['admin', 'owner']), createInvite);
router.post('/:id/revoke', authenticate, requireOrg, requireOrgRole(['admin', 'owner']), revokeInvite);
router.post('/:id/resend', authenticate, requireOrg, requireOrgRole(['admin', 'owner']), resendInvite);

export default router;

// src/routes/invites.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg, requireOrgRole, requireActiveOrg } from '../middleware/org';
import { createInvite, listInvites, revokeInvite, resendInvite } from '../controllers/invites.controller';
import { requireApiScope } from '../middleware/apiScope';

const router = Router();

router.get('/', authenticate, requireOrg, requireActiveOrg, requireApiScope('invites:read'), requireOrgRole(['admin', 'owner']), listInvites);
router.post('/', authenticate, requireOrg, requireActiveOrg, requireApiScope('invites:write'), requireOrgRole(['admin', 'owner']), createInvite);
router.post('/:id/revoke', authenticate, requireOrg, requireActiveOrg, requireApiScope('invites:write'), requireOrgRole(['admin', 'owner']), revokeInvite);
router.post('/:id/resend', authenticate, requireOrg, requireActiveOrg, requireApiScope('invites:write'), requireOrgRole(['admin', 'owner']), resendInvite);

export default router;

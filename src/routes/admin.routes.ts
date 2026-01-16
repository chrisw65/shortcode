import { Router, type RequestHandler } from 'express';
import { authenticate, requireSuperadmin } from '../middleware/auth';
import {
  listOrgsAdmin,
  getOrgAdmin,
  updateOrgStatusAdmin,
  updateOrgPlanAdmin,
  updateUserStatusAdmin,
} from '../controllers/admin.controller';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);
router.use(requireSuperadmin);

router.get('/orgs', wrap(listOrgsAdmin));
router.get('/orgs/:id', wrap(getOrgAdmin));
router.put('/orgs/:id/status', wrap(updateOrgStatusAdmin));
router.put('/orgs/:id/plan', wrap(updateOrgPlanAdmin));
router.put('/users/:id/status', wrap(updateUserStatusAdmin));

export default router;

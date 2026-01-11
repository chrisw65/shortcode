import { Router, type RequestHandler } from 'express';
import { authenticate, requireSuperadmin } from '../middleware/auth';
import { getEcosystem, updateEcosystem } from '../controllers/ecosystem.controller';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', authenticate, requireSuperadmin, wrap(getEcosystem));
router.put('/', authenticate, requireSuperadmin, wrap(updateEcosystem));

export default router;

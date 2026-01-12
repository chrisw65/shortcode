import { Router, type RequestHandler } from 'express';
import { authenticate } from '../middleware/auth';
import { requireOrg } from '../middleware/org';
import { perOrgApiRpmRedis } from '../middleware/redisRateLimit';
import { requireApiScope } from '../middleware/apiScope';
import {
  listBioPages,
  getBioPage,
  createBioPage,
  updateBioPage,
  deleteBioPage,
  createBioLink,
  updateBioLink,
  deleteBioLink,
  reorderBioLinks,
} from '../controllers/bio.controller';

const router = Router();
const wrap = (fn: any): RequestHandler => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const noLimit: RequestHandler = (_req, _res, next) => next();
const apiLimiter = process.env.RATE_LIMIT_API_DISABLED === '1' ? noLimit : perOrgApiRpmRedis;

router.use(authenticate);
router.use(requireOrg);
router.use(apiLimiter);

router.get('/', requireApiScope('bio:read'), wrap(listBioPages));
router.post('/', requireApiScope('bio:write'), wrap(createBioPage));
router.get('/:id', requireApiScope('bio:read'), wrap(getBioPage));
router.put('/:id', requireApiScope('bio:write'), wrap(updateBioPage));
router.delete('/:id', requireApiScope('bio:write'), wrap(deleteBioPage));

router.post('/:id/links', requireApiScope('bio:write'), wrap(createBioLink));
router.put('/:id/links/:linkId', requireApiScope('bio:write'), wrap(updateBioLink));
router.delete('/:id/links/:linkId', requireApiScope('bio:write'), wrap(deleteBioLink));
router.put('/:id/links/order', requireApiScope('bio:write'), wrap(reorderBioLinks));

export default router;

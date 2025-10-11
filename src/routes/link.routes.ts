import { Router } from 'express';
import { LinkController } from '../controllers/link.controller';
import { authenticate } from '../middleware/auth';

const router = Router();
const linkController = new LinkController();

router.use(authenticate);

router.post('/', linkController.createLink);
router.get('/', linkController.getUserLinks);
router.get('/:shortCode', linkController.getLinkDetails);
router.delete('/:shortCode', linkController.deleteLink);

export default router;

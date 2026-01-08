// src/routes/qr.routes.ts
import { Router } from 'express';
import { getQrPng, getQrSvg } from '../controllers/qr.controller';

const router = Router();

// Public endpoints (no auth) so QR works when embedded anywhere
router.get('/:shortCode.svg', getQrSvg);
router.get('/:shortCode.png', getQrPng);

export default router;


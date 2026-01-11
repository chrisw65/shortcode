import type { Request, Response } from 'express';
import { getEcosystemConfig, saveEcosystemConfig } from '../services/ecosystem.service';

export async function getEcosystem(req: Request, res: Response) {
  try {
    const config = await getEcosystemConfig();
    return res.json({ success: true, data: config });
  } catch (err) {
    console.error('ecosystem.get error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateEcosystem(req: Request, res: Response) {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }
    const config = await saveEcosystemConfig(payload);
    return res.json({ success: true, data: config });
  } catch (err) {
    console.error('ecosystem.update error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

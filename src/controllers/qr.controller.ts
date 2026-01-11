// src/controllers/qr.controller.ts
import type { Request, Response } from 'express';
import QRCode from 'qrcode';
import db from '../config/database';
import { log } from '../utils/logger';

function parseSize(q: unknown): number {
  const n = Number.parseInt(String(q ?? ''), 10);
  if (Number.isNaN(n)) return 256;
  return Math.min(1024, Math.max(128, n));
}

async function ensureShortExists(shortCode: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1
       FROM links
      WHERE short_code = $1
        AND active = true
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    [shortCode],
  );
  return rows.length > 0;
}

// Build the short URL we want to encode into the QR.
// We use the incoming host (works for okleaf.link, custom domains, etc.).
function shortUrlFor(req: Request, shortCode: string): string {
  const scheme = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = req.headers.host!;
  return `${scheme}://${host}/${shortCode}`;
}

export async function getQrSvg(req: Request, res: Response) {
  try {
    const { shortCode } = req.params;
    if (!shortCode) return res.status(400).send('shortCode required');

    const exists = await ensureShortExists(shortCode);
    if (!exists) return res.status(404).send('Not found');

    const size = parseSize(req.query.size);
    const data = shortUrlFor(req, shortCode);

    const svg = await QRCode.toString(data, {
      type: 'svg',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    return res.status(200).send(svg);
  } catch (e) {
    log('error', 'qr.svg error', { error: String(e) });
    return res.status(500).send('Internal server error');
  }
}

export async function getQrPng(req: Request, res: Response) {
  try {
    const { shortCode } = req.params;
    if (!shortCode) return res.status(400).send('shortCode required');

    const exists = await ensureShortExists(shortCode);
    if (!exists) return res.status(404).send('Not found');

    const size = parseSize(req.query.size);
    const data = shortUrlFor(req, shortCode);

    const buf = await QRCode.toBuffer(data, {
      type: 'png',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', String(buf.length));
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    return res.status(200).end(buf);
  } catch (e) {
    log('error', 'qr.png error', { error: String(e) });
    return res.status(500).send('Internal server error');
  }
}

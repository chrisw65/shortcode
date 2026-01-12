// src/controllers/qr.controller.ts
import type { Request, Response } from 'express';
import QRCode from 'qrcode';
import db from '../config/database';
import { log } from '../utils/logger';

function parseSize(q: unknown, fallback = 256): number {
  const n = Number.parseInt(String(q ?? ''), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(1024, Math.max(128, n));
}

function normalizeColor(value: unknown, fallback: string): string {
  if (!value) return fallback;
  const raw = String(value).trim();
  if (raw === 'transparent') return raw;
  if (/^#[0-9a-fA-F]{3}$/.test(raw) || /^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return fallback;
}

function normalizeErrorCorrection(value: unknown, fallback: 'L' | 'M' | 'Q' | 'H'): 'L' | 'M' | 'Q' | 'H' {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'L' || raw === 'M' || raw === 'Q' || raw === 'H') return raw;
  return fallback;
}

function clampLogoScale(value: unknown, fallback = 0.22): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(0.45, Math.max(0.1, parsed));
}

async function fetchLinkQrSettings(shortCode: string) {
  const { rows } = await db.query(
    `SELECT l.id, l.short_code, l.active, l.expires_at,
            qs.color, qs.bg_color, qs.size, qs.margin, qs.error_correction, qs.logo_url, qs.logo_scale
       FROM links l
       LEFT JOIN link_qr_settings qs ON qs.link_id = l.id
      WHERE l.short_code = $1
        AND l.active = true
        AND (l.expires_at IS NULL OR l.expires_at > NOW())
      LIMIT 1`,
    [shortCode],
  );
  return rows[0] || null;
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

    const link = await fetchLinkQrSettings(shortCode);
    if (!link) return res.status(404).send('Not found');

    const size = parseSize(req.query.size, link.size || 256);
    const data = shortUrlFor(req, shortCode);
    const margin = Number.isFinite(Number(req.query.margin))
      ? Math.min(10, Math.max(0, Number(req.query.margin)))
      : (link.margin ?? 1);
    const dark = normalizeColor(req.query.color, link.color || '#0b0d10');
    const light = normalizeColor(req.query.bg, link.bg_color || '#ffffff');
    const errorCorrection = normalizeErrorCorrection(req.query.ecc, link.error_correction || 'M');

    const svg = await QRCode.toString(data, {
      type: 'svg',
      width: size,
      margin,
      errorCorrectionLevel: errorCorrection,
      color: { dark, light },
    });

    let output = svg;
    const logoUrl = String(req.query.logo || link.logo_url || '').trim();
    if (logoUrl) {
      const scale = clampLogoScale(req.query.logo_scale, link.logo_scale || 0.22);
      const logoSize = Math.round(size * scale);
      const logoX = Math.round((size - logoSize) / 2);
      const logoY = Math.round((size - logoSize) / 2);
      output = svg.replace(
        '</svg>',
        `<image href="${logoUrl}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/></svg>`
      );
    }

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    return res.status(200).send(output);
  } catch (e) {
    log('error', 'qr.svg error', { error: String(e) });
    return res.status(500).send('Internal server error');
  }
}

export async function getQrPng(req: Request, res: Response) {
  try {
    const { shortCode } = req.params;
    if (!shortCode) return res.status(400).send('shortCode required');

    const link = await fetchLinkQrSettings(shortCode);
    if (!link) return res.status(404).send('Not found');

    const size = parseSize(req.query.size, link.size || 256);
    const data = shortUrlFor(req, shortCode);
    const margin = Number.isFinite(Number(req.query.margin))
      ? Math.min(10, Math.max(0, Number(req.query.margin)))
      : (link.margin ?? 1);
    const dark = normalizeColor(req.query.color, link.color || '#0b0d10');
    const light = normalizeColor(req.query.bg, link.bg_color || '#ffffff');
    const errorCorrection = normalizeErrorCorrection(req.query.ecc, link.error_correction || 'M');

    const buf = await QRCode.toBuffer(data, {
      type: 'png',
      width: size,
      margin,
      errorCorrectionLevel: errorCorrection,
      color: { dark, light },
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

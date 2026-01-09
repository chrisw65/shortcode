// src/controllers/redirect.controller.ts
import { Request, Response } from 'express';
import db from '../config/database';
import redisClient from '../config/redis';
import { lookupGeo } from '../services/geoip';
import { enqueueClick } from '../services/clickQueue';
import { getCachedLink, setCachedLink } from '../services/linkCache';

function nowUtc(): Date { return new Date(); }
function safeRedirectUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export class RedirectController {
  public redirect = async (req: Request, res: Response) => {
    try {
      const { shortCode } = req.params;

      let link = await getCachedLink(shortCode);
      if (!link) {
        const q = `
          SELECT id, original_url, expires_at, active
            FROM links
           WHERE short_code = $1
           LIMIT 1
        `;
        const { rows } = await db.query(q, [shortCode]);
        if (!rows.length) return res.status(404).send('Not found');
        link = {
          id: rows[0].id,
          original_url: rows[0].original_url,
          expires_at: rows[0].expires_at,
          active: rows[0].active !== false,
        };
        void setCachedLink(shortCode, link);
      }

      if (link.active === false) {
        return res.status(410).send('Link is paused');
      }
      if (link.expires_at && new Date(link.expires_at) <= nowUtc()) {
        return res.status(410).send('Link expired');
      }

      // Best-effort analytics: bump click_count and log click_events
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
      const referer = (req.get('referer') || null);
      const ua = (req.get('user-agent') || null);

      const fallbackDirect = async () => {
        const geo = await lookupGeo(ip);
        void db.query(`UPDATE links SET click_count = COALESCE(click_count,0) + 1 WHERE id = $1`, [link?.id]);
        void db.query(
          `INSERT INTO click_events (link_id, ip, referer, user_agent, country_code, country_name, region, city, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            link?.id,
            ip,
            referer,
            ua,
            geo?.country_code ?? null,
            geo?.country_name ?? null,
            geo?.region ?? null,
            geo?.city ?? null,
            geo?.latitude ?? null,
            geo?.longitude ?? null,
          ]
        ).catch(() => {});
      };

      if (redisClient.isReady) {
        void enqueueClick({
          link_id: link.id,
          ip,
          referer,
          user_agent: ua,
        }).catch(() => fallbackDirect());
      } else {
        void fallbackDirect();
      }

      const safeUrl = safeRedirectUrl(link.original_url);
      if (!safeUrl) return res.status(400).send('Invalid destination');
      return res.redirect(302, safeUrl);
    } catch (e) {
      console.error('redirect error:', e);
      return res.status(500).send('Internal server error');
    }
  };
}

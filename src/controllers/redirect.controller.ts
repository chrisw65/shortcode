// src/controllers/redirect.controller.ts
import { Request, Response } from 'express';
import db from '../config/database';

function nowUtc(): Date { return new Date(); }

export class RedirectController {
  public redirect = async (req: Request, res: Response) => {
    try {
      const { shortCode } = req.params;

      const q = `
        SELECT id, user_id, original_url, expires_at, active
          FROM links
         WHERE short_code = $1
         LIMIT 1
      `;
      const { rows } = await db.query(q, [shortCode]);
      if (!rows.length) return res.status(404).send('Not found');

      const link = rows[0];

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

      // Run in parallel
      void db.query(`UPDATE links SET click_count = COALESCE(click_count,0) + 1 WHERE id = $1`, [link.id]);
      void db.query(
        `INSERT INTO click_events (link_id, ip, referer, user_agent) VALUES ($1, $2, $3, $4)`,
        [link.id, ip, referer, ua]
      ).catch(() => {});

      return res.redirect(302, link.original_url);
    } catch (e) {
      console.error('redirect error:', e);
      return res.status(500).send('Internal server error');
    }
  };
}

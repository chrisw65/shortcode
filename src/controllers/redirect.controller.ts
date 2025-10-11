// src/controllers/redirect.controller.ts
import { Request, Response } from 'express';
import db from '../config/database';
import redis from '../config/redis';

export class RedirectController {
  // Bind methods in constructor to preserve 'this' context
  constructor() {
    this.redirect = this.redirect.bind(this);
  }

  /**
   * Redirect to original URL
   */
  async redirect(req: Request, res: Response) {
    try {
      const { shortCode } = req.params;

      // Check cache first (with error handling)
      try {
        const cached = await redis.get(`link:${shortCode}`);
        if (cached) {
          const link = JSON.parse(cached);
          // Track click asynchronously (don't wait)
          this.trackClick(link.id, req).catch(err => 
            console.error('Track click error:', err)
          );
          return res.redirect(302, link.original_url);
        }
      } catch (redisError) {
        console.error('Redis get error (non-fatal):', redisError);
        // Continue to database lookup
      }

      // Fetch from database
      const result = await db.query(
        `SELECT * FROM links 
         WHERE short_code = $1 
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [shortCode]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Link not found'
        });
      }

      const link = result.rows[0];

      // Cache for 1 hour (with error handling)
      try {
        await redis.setEx(
          `link:${shortCode}`,
          3600,
          JSON.stringify(link)
        );
      } catch (redisError) {
        console.error('Redis setEx error (non-fatal):', redisError);
      }

      // Track click asynchronously (don't wait)
      this.trackClick(link.id, req).catch(err => 
        console.error('Track click error:', err)
      );

      // Increment counter
      await db.query(
        'UPDATE links SET click_count = click_count + 1 WHERE id = $1',
        [link.id]
      );

      res.redirect(302, link.original_url);
    } catch (error) {
      console.error('Redirect error:', error);
      res.status(500).json({
        success: false,
        error: 'Redirect failed'
      });
    }
  }

  /**
   * Track click in database
   */
  private async trackClick(linkId: string, req: Request): Promise<void> {
    try {
      await db.query(
        `INSERT INTO clicks (link_id, ip_address, user_agent, referer)
         VALUES ($1, $2, $3, $4)`,
        [
          linkId,
          req.ip || req.socket.remoteAddress || 'unknown',
          req.headers['user-agent'] || 'unknown',
          req.headers['referer'] || null
        ]
      );
    } catch (error) {
      console.error('Track click database error:', error);
      // Don't throw - click tracking shouldn't break redirects
    }
  }
}

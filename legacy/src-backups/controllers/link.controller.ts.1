// src/controllers/link.controller.ts
import { Response } from 'express';
import { nanoid } from 'nanoid';
import db from '../config/database';
import redis from '../config/redis';
import { AuthenticatedRequest } from '../middleware/auth';

export class LinkController {
  /**
   * Create a new short link
   */
  async createLink(req: AuthenticatedRequest, res: Response) {
    try {
      const { url, customSlug } = req.body;
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid URL format' });
      }

      // Generate short code
      const shortCode = customSlug || nanoid(8);

      // Check if custom slug is available
      if (customSlug) {
        const existing = await db.query(
          'SELECT 1 FROM links WHERE short_code = $1',
          [customSlug]
        );
        if (existing.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Custom slug already taken'
          });
        }
      }

      // Extract title from URL
      let title;
      try {
        title = new URL(url).hostname;
      } catch {
        title = 'Untitled';
      }

      // Create link
      const result = await db.query(
        `INSERT INTO links (user_id, short_code, original_url, title)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, shortCode, url, title]
      );

      const link = result.rows[0];

      // Cache in Redis (with error handling)
      try {
        await redis.setEx(
          `link:${shortCode}`,
          3600, // 1 hour
          JSON.stringify(link)
        );
      } catch (redisError) {
        console.error('Redis cache error (non-fatal):', redisError);
        // Continue even if Redis fails - not critical for link creation
      }

      res.status(201).json({
        success: true,
        data: {
          ...link,
          short_url: `${process.env.SHORT_URL_BASE}/${shortCode}`
        }
      });
    } catch (error) {
      console.error('Create link error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create link'
      });
    }
  }

  /**
   * Get all links for the authenticated user
   */
  async getUserLinks(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const result = await db.query(
        `SELECT 
          id,
          user_id,
          short_code,
          original_url,
          title,
          click_count,
          created_at,
          expires_at
         FROM links 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [userId]
      );

      // Add short_url to each link
      const linksWithUrls = result.rows.map(link => ({
        ...link,
        short_url: `${process.env.SHORT_URL_BASE}/${link.short_code}`
      }));

      res.json({ 
        success: true, 
        data: linksWithUrls 
      });
    } catch (error) {
      console.error('Get user links error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch links' 
      });
    }
  }

  /**
   * Get details of a specific link by short code
   */
  async getLinkDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { shortCode } = req.params;
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const result = await db.query(
        `SELECT 
          id,
          user_id,
          short_code,
          original_url,
          title,
          click_count,
          created_at,
          expires_at
         FROM links 
         WHERE short_code = $1 AND user_id = $2`,
        [shortCode, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Link not found' 
        });
      }

      const link = result.rows[0];

      // Get recent clicks (last 10)
      const clicksResult = await db.query(
        `SELECT 
          id,
          ip_address,
          user_agent,
          referer,
          country,
          created_at
         FROM clicks 
         WHERE link_id = $1 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [link.id]
      );

      res.json({ 
        success: true, 
        data: {
          ...link,
          short_url: `${process.env.SHORT_URL_BASE}/${link.short_code}`,
          recent_clicks: clicksResult.rows
        }
      });
    } catch (error) {
      console.error('Get link details error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch link details' 
      });
    }
  }

  /**
   * Delete a link by short code
   */
  async deleteLink(req: AuthenticatedRequest, res: Response) {
    try {
      const { shortCode } = req.params;
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const result = await db.query(
        `DELETE FROM links 
         WHERE short_code = $1 AND user_id = $2 
         RETURNING *`,
        [shortCode, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Link not found' 
        });
      }

      // Clear cache (with error handling)
      try {
        await redis.del(`link:${shortCode}`);
      } catch (redisError) {
        console.error('Redis delete error (non-fatal):', redisError);
        // Continue even if Redis fails
      }

      res.json({ 
        success: true, 
        message: 'Link deleted successfully' 
      });
    } catch (error) {
      console.error('Delete link error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delete link' 
      });
    }
  }
}

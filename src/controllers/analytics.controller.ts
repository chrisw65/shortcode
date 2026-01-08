// src/controllers/analytics.controller.ts
import { Request, Response } from 'express';
import db from '../config/database';

type ReqWithUser = Request & { user?: { userId?: string } };

function bucketUserAgent(ua: string | null): 'mobile' | 'desktop' | 'bot' | 'other' {
  if (!ua) return 'other';
  const u = ua.toLowerCase();
  if (/(bot|crawler|spider)/.test(u)) return 'bot';
  if (/(iphone|ipad|android|mobile)/.test(u)) return 'mobile';
  if (/(windows|macintosh|linux|x11)/.test(u)) return 'desktop';
  return 'other';
}

function rangeToInterval(rangeRaw: unknown): string | null {
  const range = String(rangeRaw || '').toLowerCase().trim();
  if (!range || range === '7d') return '7 days';
  if (range === '24h') return '24 hours';
  if (range === '30d') return '30 days';
  if (range === '90d') return '90 days';
  if (range === 'all') return null;
  return '7 days';
}

function withRangeSql(prefix: string, rangeRaw: unknown, params: any[]) {
  const interval = rangeToInterval(rangeRaw);
  if (!interval) return { sql: '', params };
  params.push(interval);
  return { sql: ` AND ${prefix}.occurred_at >= NOW() - $${params.length}::interval `, params };
}

/**
 * GET /api/analytics/summary
 */
export async function summary(req: ReqWithUser, res: Response) {
  try {
    const orgId = (req as any).org?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const range = req.query.range;

    const series = await db.query<{ h: string; count: string | number }>(`
      WITH series AS (
        SELECT generate_series(
          date_trunc('hour', NOW()) - INTERVAL '23 hours',
          date_trunc('hour', NOW()),
          INTERVAL '1 hour'
        ) AS h
      )
      SELECT to_char(s.h, 'YYYY-MM-DD"T"HH24:00:00"Z"') AS h,
             COALESCE(COUNT(l.id), 0) AS count
      FROM series s
      LEFT JOIN click_events c
        ON date_trunc('hour', c.occurred_at) = s.h
      LEFT JOIN links l
        ON l.id = c.link_id AND l.org_id = $1
      GROUP BY s.h
      ORDER BY s.h
    `, [orgId]);

    const totals = await db.query<{ total_clicks: string; last_click_at: Date | null; clicks_24h: string }>(`
      SELECT COUNT(*)::bigint AS total_clicks,
             MAX(occurred_at) AS last_click_at,
             SUM(CASE WHEN occurred_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END)::bigint AS clicks_24h
      FROM click_events c
      JOIN links l ON l.id = c.link_id
      WHERE l.org_id = $1
    `, [orgId]);

    let clicksRange = Number(totals.rows[0]?.clicks_24h || 0);
    const rangeInterval = rangeToInterval(range);
    if (rangeInterval) {
      const rangeRes = await db.query<{ count: string }>(`
        SELECT COUNT(*)::bigint AS count
        FROM click_events c
        JOIN links l ON l.id = c.link_id
        WHERE l.org_id = $1 AND c.occurred_at >= NOW() - $2::interval
      `, [orgId, rangeInterval]);
      clicksRange = Number(rangeRes.rows[0]?.count || 0);
    } else {
      clicksRange = Number(totals.rows[0]?.total_clicks || 0);
    }

    const refParams: any[] = [orgId];
    const refRange = withRangeSql('c', range, refParams);
    const referrers = await db.query<{ referrer: string | null; count: string }>(`
      SELECT COALESCE(NULLIF(TRIM(referer), ''), '(direct)') AS referrer,
             COUNT(*)::bigint AS count
      FROM click_events c
      JOIN links l ON l.id = c.link_id
      WHERE l.org_id = $1 ${refRange.sql}
      GROUP BY 1
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `, refRange.params);

    const uaParams: any[] = [orgId];
    const uaRange = withRangeSql('c', range, uaParams);
    const uas = await db.query<{ ua: string | null; count: string }>(`
      SELECT user_agent AS ua, COUNT(*)::bigint AS count
      FROM click_events c
      JOIN links l ON l.id = c.link_id
      WHERE l.org_id = $1 ${uaRange.sql}
      GROUP BY 1
      ORDER BY COUNT(*) DESC
      LIMIT 200
    `, uaRange.params);

    const geoParams: any[] = [orgId];
    const geoRange = withRangeSql('c', range, geoParams);
    const countries = await db.query<{ country: string | null; code: string | null; count: string }>(`
      SELECT COALESCE(country_name, 'Unknown') AS country,
             country_code AS code,
             COUNT(*)::bigint AS count
      FROM click_events c
      JOIN links l ON l.id = c.link_id
      WHERE l.org_id = $1 ${geoRange.sql}
      GROUP BY 1, 2
      ORDER BY COUNT(*) DESC
      LIMIT 15
    `, geoRange.params);

    const cityParams: any[] = [orgId];
    const cityRange = withRangeSql('c', range, cityParams);
    const cities = await db.query<{ city: string | null; country: string | null; count: string }>(`
      SELECT COALESCE(city, 'Unknown') AS city,
             COALESCE(country_name, 'Unknown') AS country,
             COUNT(*)::bigint AS count
      FROM click_events c
      JOIN links l ON l.id = c.link_id
      WHERE l.org_id = $1 ${cityRange.sql}
      GROUP BY 1, 2
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `, cityRange.params);

    const uaBuckets = uas.rows.reduce<Record<string, number>>((acc, row) => {
      const b = bucketUserAgent(row.ua);
      acc[b] = (acc[b] ?? 0) + Number(row.count || 0);
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        sparkline: series.rows.map((r) => ({ t: r.h, y: Number(r.count) })),
        total_clicks: Number(totals.rows[0]?.total_clicks || 0),
        clicks_24h: Number(totals.rows[0]?.clicks_24h || 0),
        clicks_range: clicksRange,
        last_click_at: totals.rows[0]?.last_click_at ?? null,
        top_referrers: referrers.rows.map((r) => ({
          referrer: r.referrer ?? '(direct)',
          count: Number(r.count),
        })),
        top_countries: countries.rows.map((r) => ({
          country: r.country ?? 'Unknown',
          code: r.code ?? null,
          count: Number(r.count),
        })),
        top_cities: cities.rows.map((r) => ({
          city: r.city ?? 'Unknown',
          country: r.country ?? 'Unknown',
          count: Number(r.count),
        })),
        user_agents: Object.entries(uaBuckets).map(([group, count]) => ({ group, count })),
      },
    });
  } catch (e) {
    console.error('analytics.summary error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/analytics/links/:shortCode/summary
 */
export async function linkSummary(req: ReqWithUser, res: Response) {
  try {
    const orgId = (req as any).org?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const range = req.query.range;

    const { shortCode } = req.params;
    const linkRow = await db.query<{ id: string; title: string | null }>(
      `SELECT id, title FROM links WHERE org_id = $1 AND short_code = $2`,
      [orgId, shortCode],
    );
    if (!linkRow.rowCount) {
      return res.status(404).json({ success: false, error: 'Link not found' });
    }
    const linkId = linkRow.rows[0].id;
    const title = linkRow.rows[0].title ?? '';

    const series = await db.query<{ h: string; count: string | number }>(`
      WITH series AS (
        SELECT generate_series(
          date_trunc('hour', NOW()) - INTERVAL '23 hours',
          date_trunc('hour', NOW()),
          INTERVAL '1 hour'
        ) AS h
      )
      SELECT to_char(s.h, 'YYYY-MM-DD"T"HH24:00:00"Z"') AS h,
             COALESCE(COUNT(c.*), 0) AS count
      FROM series s
      LEFT JOIN click_events c
        ON date_trunc('hour', c.occurred_at) = s.h
       AND c.link_id = $1
      GROUP BY s.h
      ORDER BY s.h
    `, [linkId]);

    const totals = await db.query<{ total_clicks: string; last_click_at: Date | null; clicks_24h: string }>(`
      SELECT COUNT(*)::bigint AS total_clicks,
             MAX(occurred_at) AS last_click_at,
             SUM(CASE WHEN occurred_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END)::bigint AS clicks_24h
      FROM click_events
      WHERE link_id = $1
    `, [linkId]);

    let clicksRange = Number(totals.rows[0]?.clicks_24h || 0);
    const rangeInterval = rangeToInterval(range);
    if (rangeInterval) {
      const rangeRes = await db.query<{ count: string }>(`
        SELECT COUNT(*)::bigint AS count
        FROM click_events
        WHERE link_id = $1 AND occurred_at >= NOW() - $2::interval
      `, [linkId, rangeInterval]);
      clicksRange = Number(rangeRes.rows[0]?.count || 0);
    } else {
      clicksRange = Number(totals.rows[0]?.total_clicks || 0);
    }

    const refParams: any[] = [linkId];
    const refRange = withRangeSql('c', range, refParams);
    const referrers = await db.query<{ referrer: string | null; count: string }>(`
      SELECT COALESCE(NULLIF(TRIM(referer), ''), '(direct)') AS referrer,
             COUNT(*)::bigint AS count
      FROM click_events c
      WHERE c.link_id = $1 ${refRange.sql}
      GROUP BY 1
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `, refRange.params);

    const uaParams: any[] = [linkId];
    const uaRange = withRangeSql('c', range, uaParams);
    const uas = await db.query<{ ua: string | null; count: string }>(`
      SELECT user_agent AS ua, COUNT(*)::bigint AS count
      FROM click_events c
      WHERE c.link_id = $1 ${uaRange.sql}
      GROUP BY 1
      ORDER BY COUNT(*) DESC
      LIMIT 200
    `, uaRange.params);

    const geoParams: any[] = [linkId];
    const geoRange = withRangeSql('c', range, geoParams);
    const countries = await db.query<{ country: string | null; code: string | null; count: string }>(`
      SELECT COALESCE(country_name, 'Unknown') AS country,
             country_code AS code,
             COUNT(*)::bigint AS count
      FROM click_events c
      WHERE link_id = $1 ${geoRange.sql}
      GROUP BY 1, 2
      ORDER BY COUNT(*) DESC
      LIMIT 15
    `, geoRange.params);

    const cityParams: any[] = [linkId];
    const cityRange = withRangeSql('c', range, cityParams);
    const cities = await db.query<{ city: string | null; country: string | null; count: string }>(`
      SELECT COALESCE(city, 'Unknown') AS city,
             COALESCE(country_name, 'Unknown') AS country,
             COUNT(*)::bigint AS count
      FROM click_events c
      WHERE link_id = $1 ${cityRange.sql}
      GROUP BY 1, 2
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `, cityRange.params);

    const uaBuckets = uas.rows.reduce<Record<string, number>>((acc, row) => {
      const b = bucketUserAgent(row.ua);
      acc[b] = (acc[b] ?? 0) + Number(row.count || 0);
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        short_code: shortCode,
        title,
        total_clicks: Number(totals.rows[0]?.total_clicks || 0),
        last_click_at: totals.rows[0]?.last_click_at ?? null,
        clicks_24h: Number(totals.rows[0]?.clicks_24h || 0),
        clicks_range: clicksRange,
        top_referrers: referrers.rows.map((r) => ({
          referrer: r.referrer ?? '(direct)',
          count: Number(r.count),
        })),
        top_countries: countries.rows.map((r) => ({
          country: r.country ?? 'Unknown',
          code: r.code ?? null,
          count: Number(r.count),
        })),
        top_cities: cities.rows.map((r) => ({
          city: r.city ?? 'Unknown',
          country: r.country ?? 'Unknown',
          count: Number(r.count),
        })),
        user_agents: Object.entries(uaBuckets).map(([group, count]) => ({ group, count })),
        sparkline: series.rows.map((r) => ({ t: r.h, y: Number(r.count) })),
      },
    });
  } catch (e) {
    console.error('analytics.linkSummary error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/analytics/links/:shortCode/events?limit=50
 */
export async function linkEvents(req: ReqWithUser, res: Response) {
  try {
    const orgId = (req as any).org?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { shortCode } = req.params;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 500);
    const range = req.query.range;

    const linkRow = await db.query<{ id: string }>(
      `SELECT id FROM links WHERE org_id = $1 AND short_code = $2`,
      [orgId, shortCode],
    );
    if (!linkRow.rowCount) {
      return res.status(404).json({ success: false, error: 'Link not found' });
    }
    const linkId = linkRow.rows[0].id;

    const evParams: any[] = [linkId, limit];
    const evRange = withRangeSql('click_events', range, evParams);
    const events = await db.query<{
      occurred_at: Date;
      ip: string | null;
      user_agent: string | null;
      referer: string | null;
      country_code: string | null;
      country_name: string | null;
      city: string | null;
    }>(`
      SELECT occurred_at, ip::text AS ip, user_agent, referer, country_code, country_name, city
      FROM click_events
      WHERE link_id = $1 ${evRange.sql}
      ORDER BY occurred_at DESC
      LIMIT $2
    `, evRange.params);

    return res.json({
      success: true,
      data: events.rows.map((r) => ({
        occurred_at: r.occurred_at,
        ip: r.ip,
        user_agent: r.user_agent,
        referer: r.referer,
        country_code: r.country_code,
        country_name: r.country_name,
        city: r.city,
      })),
    });
  } catch (e) {
    console.error('analytics.linkEvents error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/analytics/domains/:id/summary
 */
export async function domainSummary(req: ReqWithUser, res: Response) {
  try {
    const orgId = (req as any).org?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { id } = req.params;
    const domainRow = await db.query<{ id: string; domain: string }>(
      `SELECT id, domain FROM domains WHERE org_id = $1 AND id = $2`,
      [orgId, id]
    );
    if (!domainRow.rowCount) return res.status(404).json({ success: false, error: 'Domain not found' });

    const series = await db.query<{ h: string; count: string | number }>(`
      WITH series AS (
        SELECT generate_series(
          date_trunc('hour', NOW()) - INTERVAL '23 hours',
          date_trunc('hour', NOW()),
          INTERVAL '1 hour'
        ) AS h
      )
      SELECT to_char(s.h, 'YYYY-MM-DD"T"HH24:00:00"Z"') AS h,
             COALESCE(COUNT(c.*), 0) AS count
      FROM series s
      LEFT JOIN click_events c
        ON date_trunc('hour', c.occurred_at) = s.h
      LEFT JOIN links l
        ON l.id = c.link_id AND l.domain_id = $1
      GROUP BY s.h
      ORDER BY s.h
    `, [id]);

    const totals = await db.query<{ total_clicks: string; last_click_at: Date | null; clicks_24h: string }>(`
      SELECT COUNT(*)::bigint AS total_clicks,
             MAX(occurred_at) AS last_click_at,
             SUM(CASE WHEN occurred_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END)::bigint AS clicks_24h
      FROM click_events c
      JOIN links l ON l.id = c.link_id
      WHERE l.domain_id = $1
    `, [id]);

    return res.json({
      success: true,
      data: {
        domain: domainRow.rows[0].domain,
        total_clicks: Number(totals.rows[0]?.total_clicks || 0),
        clicks_24h: Number(totals.rows[0]?.clicks_24h || 0),
        last_click_at: totals.rows[0]?.last_click_at ?? null,
        sparkline: series.rows.map((r) => ({ t: r.h, y: Number(r.count) })),
      },
    });
  } catch (e) {
    console.error('analytics.domainSummary error:', e);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// src/controllers/analytics.controller.ts
import type { Response } from 'express';
import UAParser from 'ua-parser-js';
import db from '../config/database';
import redisClient from '../config/redis';
import type { OrgRequest } from '../middleware/org';
import { log } from '../utils/logger';
type TimeFilter =
  | { error: string }
  | { sql: string; params: any[]; start: Date | null; end: Date | null; mode: 'custom' | 'range' };

function bucketUserAgent(ua: string | null): 'mobile' | 'desktop' | 'bot' | 'other' {
  if (!ua) return 'other';
  const u = ua.toLowerCase();
  if (/(bot|crawler|spider)/.test(u)) return 'bot';
  if (/(iphone|ipad|android|mobile)/.test(u)) return 'mobile';
  if (/(windows|macintosh|linux|x11)/.test(u)) return 'desktop';
  return 'other';
}

function buildUaDetails(rows: Array<{ ua: string | null; count: string | number }>) {
  const browsers = new Map<string, number>();
  const os = new Map<string, number>();
  const devices = new Map<string, number>();

  for (const row of rows) {
    const count = Number(row.count || 0);
    if (!row.ua) continue;
    const parser = new UAParser(row.ua);
    const b = parser.getBrowser().name || 'Other';
    const o = parser.getOS().name || 'Other';
    const d = parser.getDevice().type || 'desktop';
    browsers.set(b, (browsers.get(b) || 0) + count);
    os.set(o, (os.get(o) || 0) + count);
    devices.set(d, (devices.get(d) || 0) + count);
  }

  const mapToList = (m: Map<string, number>) =>
    Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

  return {
    browsers: mapToList(browsers),
    os: mapToList(os),
    devices: mapToList(devices),
  };
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

function parseDateInput(value: unknown): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function withRangeSql(prefix: string, rangeRaw: unknown, params: any[]) {
  const interval = rangeToInterval(rangeRaw);
  if (!interval) return { sql: '', params };
  params.push(interval);
  return { sql: ` AND ${prefix}.occurred_at >= NOW() - $${params.length}::interval `, params };
}

function withDateRangeSql(prefix: string, start: Date | null, end: Date | null, params: any[]) {
  let sql = '';
  if (start) {
    params.push(start.toISOString());
    sql += ` AND ${prefix}.occurred_at >= $${params.length}::timestamptz `;
  }
  if (end) {
    params.push(end.toISOString());
    sql += ` AND ${prefix}.occurred_at <= $${params.length}::timestamptz `;
  }
  return { sql, params };
}

function resolveTimeFilters(prefix: string, rangeRaw: unknown, startRaw: unknown, endRaw: unknown, params: any[]): TimeFilter {
  const start = parseDateInput(startRaw);
  const end = parseDateInput(endRaw);
  if (start && end && start > end) {
    return { error: 'start_date must be before end_date' };
  }
  if (start || end) {
    const res = withDateRangeSql(prefix, start, end, params);
    return { ...res, start, end, mode: 'custom' as const };
  }
  const res = withRangeSql(prefix, rangeRaw, params);
  return { ...res, start: null, end: null, mode: 'range' as const };
}

function withCountrySql(prefix: string, countryRaw: unknown, params: any[]) {
  const country = String(countryRaw || '').trim();
  if (!country) return { sql: '', params };
  params.push(country.toUpperCase());
  params.push(country);
  return { sql: ` AND (${prefix}.country_code = $${params.length - 1} OR ${prefix}.country_name = $${params.length}) `, params };
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function sendCsv(res: Response, filename: string, headers: string[], rows: Record<string, unknown>[]) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(lines.join('\n'));
}

function cacheKey(parts: Array<string | number | null | undefined>) {
  return ['analytics', ...parts.map((p) => String(p ?? ''))].join(':');
}

async function getCached<T>(key: string): Promise<T | null> {
  if (!redisClient.isReady) return null;
  try {
    const raw = await redisClient.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function setCached<T>(key: string, data: T, ttlSeconds: number) {
  if (!redisClient.isReady) return;
  try {
    await redisClient.set(key, JSON.stringify(data), { EX: ttlSeconds });
  } catch {
    // best-effort
  }
}

/**
 * GET /api/analytics/summary
 */
export async function summary(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const range = req.query.range;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const cacheId = cacheKey(['summary', orgId, range, startDate, endDate]);
    const cached = await getCached<any>(cacheId);
    if (cached) return res.json({ success: true, data: cached });

    const seriesParams: any[] = [orgId];
    const seriesFilters = resolveTimeFilters('c', range, startDate, endDate, seriesParams);
    if ('error' in seriesFilters) {
      return res.status(400).json({ success: false, error: seriesFilters.error });
    }
    const start = seriesFilters.start;
    const end = seriesFilters.end;
    const rangeMs = start && end ? end.getTime() - start.getTime() : 0;
    const useHourly = !start || !end || rangeMs <= 7 * 24 * 60 * 60 * 1000;
    const seriesStep = useHourly ? '1 hour' : '1 day';
    const seriesTrunc = useHourly ? 'hour' : 'day';
    const seriesStart = start ? start.toISOString() : null;
    const seriesEnd = end ? end.toISOString() : null;
    const seriesSql = start && end ? `
      WITH series AS (
        SELECT generate_series(
          date_trunc('${seriesTrunc}', $2::timestamptz),
          date_trunc('${seriesTrunc}', $3::timestamptz),
          INTERVAL '${seriesStep}'
        ) AS h
      )
      SELECT to_char(s.h, ${useHourly ? `'YYYY-MM-DD"T"HH24:00:00"Z"'` : `'YYYY-MM-DD'`}) AS h,
             COALESCE(COUNT(l.id), 0) AS count
      FROM series s
      LEFT JOIN click_events c
        ON date_trunc('${seriesTrunc}', c.occurred_at) = s.h
       AND c.occurred_at >= $2::timestamptz
       AND c.occurred_at <= $3::timestamptz
      LEFT JOIN links l
        ON l.id = c.link_id AND l.org_id = $1
      GROUP BY s.h
      ORDER BY s.h
    ` : `
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
    `;
    const seriesQueryParams = start && end ? [orgId, seriesStart, seriesEnd] : [orgId];
    const series = await db.query<{ h: string; count: string | number }>(seriesSql, seriesQueryParams);

    const totalsParams: any[] = [orgId];
    const totalsRange = resolveTimeFilters('c', range, startDate, endDate, totalsParams);
    if ('error' in totalsRange) {
      return res.status(400).json({ success: false, error: totalsRange.error });
    }
    const totals = await db.query<{ total_clicks: string; last_click_at: Date | null; clicks_24h: string }>(`
      SELECT COUNT(*)::bigint AS total_clicks,
             MAX(occurred_at) AS last_click_at,
             SUM(CASE WHEN occurred_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END)::bigint AS clicks_24h
      FROM click_events c
      JOIN links l ON l.id = c.link_id
      WHERE l.org_id = $1 ${totalsRange.sql}
    `, totalsRange.params);

    let clicksRange = Number(totals.rows[0]?.clicks_24h || 0);
    if (totalsRange.mode === 'custom') {
      clicksRange = Number(totals.rows[0]?.total_clicks || 0);
    } else {
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
    }

    const refParams: any[] = [orgId];
    const refRange = resolveTimeFilters('c', range, startDate, endDate, refParams);
    if ('error' in refRange) {
      return res.status(400).json({ success: false, error: refRange.error });
    }
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
    const uaRange = resolveTimeFilters('c', range, startDate, endDate, uaParams);
    if ('error' in uaRange) {
      return res.status(400).json({ success: false, error: uaRange.error });
    }
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
    const geoRange = resolveTimeFilters('c', range, startDate, endDate, geoParams);
    if ('error' in geoRange) {
      return res.status(400).json({ success: false, error: geoRange.error });
    }
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
    const cityRange = resolveTimeFilters('c', range, startDate, endDate, cityParams);
    if ('error' in cityRange) {
      return res.status(400).json({ success: false, error: cityRange.error });
    }
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
    const uaDetail = buildUaDetails(uas.rows);

    const pointParams: any[] = [orgId];
    const pointRange = resolveTimeFilters('c', range, startDate, endDate, pointParams);
    if ('error' in pointRange) {
      return res.status(400).json({ success: false, error: pointRange.error });
    }
    const points = await db.query<{ latitude: number; longitude: number; count: string }>(`
      SELECT latitude, longitude, COUNT(*)::bigint AS count
      FROM click_events c
      JOIN links l ON l.id = c.link_id
      WHERE l.org_id = $1 ${pointRange.sql}
        AND latitude IS NOT NULL AND longitude IS NOT NULL
      GROUP BY 1, 2
      ORDER BY COUNT(*) DESC
      LIMIT 300
    `, pointRange.params);

    const payload = {
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
        geo_points: points.rows.map((p) => ({
          lat: Number(p.latitude),
          lon: Number(p.longitude),
          count: Number(p.count),
        })),
        user_agents: Object.entries(uaBuckets).map(([group, count]) => ({ group, count })),
        ua_detail: uaDetail,
      },
    };
    await setCached(cacheId, payload.data, 30);
    return res.json(payload);
  } catch (e) {
    log('error', 'analytics.summary.error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/analytics/links/:shortCode/summary
 */
export async function linkSummary(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const range = req.query.range;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const country = req.query.country;
    const cacheId = cacheKey(['linkSummary', orgId, req.params.shortCode, range, startDate, endDate, country]);
    const cached = await getCached<any>(cacheId);
    if (cached) return res.json({ success: true, data: cached });

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

    const seriesParams: any[] = [linkId];
    const seriesRange = resolveTimeFilters('c', range, startDate, endDate, seriesParams);
    if ('error' in seriesRange) {
      return res.status(400).json({ success: false, error: seriesRange.error });
    }
    const start = seriesRange.start;
    const end = seriesRange.end;
    const rangeMs = start && end ? end.getTime() - start.getTime() : 0;
    const useHourly = !start || !end || rangeMs <= 7 * 24 * 60 * 60 * 1000;
    const seriesStep = useHourly ? '1 hour' : '1 day';
    const seriesTrunc = useHourly ? 'hour' : 'day';
    const seriesStart = start ? start.toISOString() : null;
    const seriesEnd = end ? end.toISOString() : null;
    const seriesCountry = withCountrySql('c', country, start && end ? [linkId, seriesStart, seriesEnd] : [linkId]);
    const seriesSql = start && end ? `
      WITH series AS (
        SELECT generate_series(
          date_trunc('${seriesTrunc}', $2::timestamptz),
          date_trunc('${seriesTrunc}', $3::timestamptz),
          INTERVAL '${seriesStep}'
        ) AS h
      )
      SELECT to_char(s.h, ${useHourly ? `'YYYY-MM-DD"T"HH24:00:00"Z"'` : `'YYYY-MM-DD'`}) AS h,
             COALESCE(COUNT(c.*), 0) AS count
      FROM series s
      LEFT JOIN click_events c
        ON date_trunc('${seriesTrunc}', c.occurred_at) = s.h
       AND c.link_id = $1
       AND c.occurred_at >= $2::timestamptz
       AND c.occurred_at <= $3::timestamptz
       ${seriesCountry.sql}
      GROUP BY s.h
      ORDER BY s.h
    ` : `
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
       AND c.link_id = $1 ${seriesCountry.sql}
      GROUP BY s.h
      ORDER BY s.h
    `;
    const seriesQueryParams = seriesCountry.params;
    const series = await db.query<{ h: string; count: string | number }>(seriesSql, seriesQueryParams);

    const totalsParams: any[] = [linkId];
    const totalsRange = resolveTimeFilters('click_events', range, startDate, endDate, totalsParams);
    if ('error' in totalsRange) {
      return res.status(400).json({ success: false, error: totalsRange.error });
    }
    const totals = await db.query<{ total_clicks: string; last_click_at: Date | null; clicks_24h: string }>(`
      SELECT COUNT(*)::bigint AS total_clicks,
             MAX(occurred_at) AS last_click_at,
             SUM(CASE WHEN occurred_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END)::bigint AS clicks_24h
      FROM click_events
      WHERE link_id = $1 ${totalsRange.sql}
    `, totalsRange.params);

    let clicksRange = Number(totals.rows[0]?.clicks_24h || 0);
    if (totalsRange.mode === 'custom') {
      clicksRange = Number(totals.rows[0]?.total_clicks || 0);
    } else {
      const rangeInterval = rangeToInterval(range);
      if (rangeInterval) {
        const rangeParams: any[] = [linkId, rangeInterval];
        const rangeCountry = withCountrySql('click_events', country, rangeParams);
        const rangeRes = await db.query<{ count: string }>(`
          SELECT COUNT(*)::bigint AS count
          FROM click_events
          WHERE link_id = $1 AND occurred_at >= NOW() - $2::interval ${rangeCountry.sql}
        `, rangeCountry.params);
        clicksRange = Number(rangeRes.rows[0]?.count || 0);
      } else {
        clicksRange = Number(totals.rows[0]?.total_clicks || 0);
      }
    }

    const refParams: any[] = [linkId];
    const refRange = resolveTimeFilters('c', range, startDate, endDate, refParams);
    if ('error' in refRange) {
      return res.status(400).json({ success: false, error: refRange.error });
    }
    const refCountry = withCountrySql('c', country, refRange.params);
    const referrers = await db.query<{ referrer: string | null; count: string }>(`
      SELECT COALESCE(NULLIF(TRIM(referer), ''), '(direct)') AS referrer,
             COUNT(*)::bigint AS count
      FROM click_events c
      WHERE c.link_id = $1 ${refRange.sql} ${refCountry.sql}
      GROUP BY 1
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `, refCountry.params);

    const uaParams: any[] = [linkId];
    const uaRange = resolveTimeFilters('c', range, startDate, endDate, uaParams);
    if ('error' in uaRange) {
      return res.status(400).json({ success: false, error: uaRange.error });
    }
    const uaCountry = withCountrySql('c', country, uaRange.params);
    const uas = await db.query<{ ua: string | null; count: string }>(`
      SELECT user_agent AS ua, COUNT(*)::bigint AS count
      FROM click_events c
      WHERE c.link_id = $1 ${uaRange.sql} ${uaCountry.sql}
      GROUP BY 1
      ORDER BY COUNT(*) DESC
      LIMIT 200
    `, uaCountry.params);

    const geoParams: any[] = [linkId];
    const geoRange = resolveTimeFilters('c', range, startDate, endDate, geoParams);
    if ('error' in geoRange) {
      return res.status(400).json({ success: false, error: geoRange.error });
    }
    const geoCountry = withCountrySql('c', country, geoRange.params);
    const countries = await db.query<{ country: string | null; code: string | null; count: string }>(`
      SELECT COALESCE(country_name, 'Unknown') AS country,
             country_code AS code,
             COUNT(*)::bigint AS count
      FROM click_events c
      WHERE link_id = $1 ${geoRange.sql} ${geoCountry.sql}
      GROUP BY 1, 2
      ORDER BY COUNT(*) DESC
      LIMIT 15
    `, geoCountry.params);

    const cityParams: any[] = [linkId];
    const cityRange = resolveTimeFilters('c', range, startDate, endDate, cityParams);
    if ('error' in cityRange) {
      return res.status(400).json({ success: false, error: cityRange.error });
    }
    const cityCountry = withCountrySql('c', country, cityRange.params);
    const cities = await db.query<{ city: string | null; country: string | null; count: string }>(`
      SELECT COALESCE(city, 'Unknown') AS city,
             COALESCE(country_name, 'Unknown') AS country,
             COUNT(*)::bigint AS count
      FROM click_events c
      WHERE link_id = $1 ${cityRange.sql} ${cityCountry.sql}
      GROUP BY 1, 2
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `, cityCountry.params);

    const pointParams: any[] = [linkId];
    const pointRange = resolveTimeFilters('c', range, startDate, endDate, pointParams);
    if ('error' in pointRange) {
      return res.status(400).json({ success: false, error: pointRange.error });
    }
    const pointCountry = withCountrySql('c', country, pointRange.params);
    const points = await db.query<{ latitude: number; longitude: number; count: string }>(`
      SELECT latitude, longitude, COUNT(*)::bigint AS count
      FROM click_events c
      WHERE c.link_id = $1 ${pointRange.sql} ${pointCountry.sql}
        AND latitude IS NOT NULL AND longitude IS NOT NULL
      GROUP BY 1, 2
      ORDER BY COUNT(*) DESC
      LIMIT 200
    `, pointCountry.params);

    const uaBuckets = uas.rows.reduce<Record<string, number>>((acc, row) => {
      const b = bucketUserAgent(row.ua);
      acc[b] = (acc[b] ?? 0) + Number(row.count || 0);
      return acc;
    }, {});
    const uaDetail = buildUaDetails(uas.rows);

    const payload = {
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
        geo_points: points.rows.map((p) => ({
          lat: Number(p.latitude),
          lon: Number(p.longitude),
          count: Number(p.count),
        })),
        user_agents: Object.entries(uaBuckets).map(([group, count]) => ({ group, count })),
        ua_detail: uaDetail,
        sparkline: series.rows.map((r) => ({ t: r.h, y: Number(r.count) })),
      },
    };
    await setCached(cacheId, payload.data, 30);
    return res.json(payload);
  } catch (e) {
    log('error', 'analytics.linkSummary.error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/analytics/links/:shortCode/events?limit=50
 */
export async function linkEvents(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { shortCode } = req.params;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 500);
    const range = req.query.range;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const country = req.query.country;

    const linkRow = await db.query<{ id: string }>(
      `SELECT id FROM links WHERE org_id = $1 AND short_code = $2`,
      [orgId, shortCode],
    );
    if (!linkRow.rowCount) {
      return res.status(404).json({ success: false, error: 'Link not found' });
    }
    const linkId = linkRow.rows[0].id;

    const evParams: any[] = [linkId];
    const evRange = resolveTimeFilters('click_events', range, startDate, endDate, evParams);
    if ('error' in evRange) {
      return res.status(400).json({ success: false, error: evRange.error });
    }
    const evCountry = withCountrySql('click_events', country, evRange.params);
    evCountry.params.push(limit);
    const limitIdx = evCountry.params.length;
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
      WHERE link_id = $1 ${evRange.sql} ${evCountry.sql}
      ORDER BY occurred_at DESC
      LIMIT $${limitIdx}
    `, evCountry.params);

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
    log('error', 'analytics.linkEvents.error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/analytics/export?range=7d&country=US
 */
export async function exportOrgCsv(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const range = req.query.range;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const country = req.query.country;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '5000'), 10) || 5000, 1), 20000);

    const params: any[] = [orgId];
    const rangeSql = resolveTimeFilters('c', range, startDate, endDate, params);
    if ('error' in rangeSql) {
      return res.status(400).json({ success: false, error: rangeSql.error });
    }
    const countrySql = withCountrySql('c', country, rangeSql.params);
    countrySql.params.push(limit);
    const limitIdx = countrySql.params.length;

    const rows = await db.query<{
      occurred_at: Date;
      short_code: string;
      title: string | null;
      domain: string | null;
      ip: string | null;
      country_code: string | null;
      country_name: string | null;
      region: string | null;
      city: string | null;
      latitude: number | null;
      longitude: number | null;
      referer: string | null;
      user_agent: string | null;
    }>(`
      SELECT c.occurred_at,
             l.short_code,
             l.title,
             d.domain AS domain,
             c.ip::text AS ip,
             c.country_code,
             c.country_name,
             c.region,
             c.city,
             c.latitude,
             c.longitude,
             c.referer,
             c.user_agent
      FROM click_events c
      JOIN links l ON l.id = c.link_id
      LEFT JOIN domains d ON d.id = l.domain_id
      WHERE l.org_id = $1 ${rangeSql.sql} ${countrySql.sql}
      ORDER BY c.occurred_at DESC
      LIMIT $${limitIdx}
    `, countrySql.params);

    const data = rows.rows.map((r) => ({
      occurred_at: r.occurred_at?.toISOString(),
      short_code: r.short_code,
      title: r.title ?? '',
      domain: r.domain ?? '',
      ip: r.ip ?? '',
      country_code: r.country_code ?? '',
      country: r.country_name ?? '',
      region: r.region ?? '',
      city: r.city ?? '',
      latitude: r.latitude ?? '',
      longitude: r.longitude ?? '',
      referer: r.referer ?? '',
      user_agent: r.user_agent ?? '',
    }));

    const filename = `org-analytics-${String(range || '7d')}.csv`;
    return sendCsv(res, filename, [
      'occurred_at',
      'short_code',
      'title',
      'domain',
      'ip',
      'country_code',
      'country',
      'region',
      'city',
      'latitude',
      'longitude',
      'referer',
      'user_agent',
    ], data);
  } catch (e) {
    log('error', 'analytics.exportOrgCsv.error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/analytics/links/:shortCode/export?range=7d&country=US
 */
export async function exportLinkCsv(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { shortCode } = req.params;
    const range = req.query.range;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const country = req.query.country;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '5000'), 10) || 5000, 1), 20000);

    const linkRow = await db.query<{ id: string; title: string | null; short_code: string }>(
      `SELECT id, title, short_code FROM links WHERE org_id = $1 AND short_code = $2`,
      [orgId, shortCode],
    );
    if (!linkRow.rowCount) {
      return res.status(404).json({ success: false, error: 'Link not found' });
    }
    const linkId = linkRow.rows[0].id;

    const params: any[] = [linkId];
    const rangeSql = resolveTimeFilters('c', range, startDate, endDate, params);
    if ('error' in rangeSql) {
      return res.status(400).json({ success: false, error: rangeSql.error });
    }
    const countrySql = withCountrySql('c', country, rangeSql.params);
    countrySql.params.push(limit);
    const limitIdx = countrySql.params.length;

    const rows = await db.query<{
      occurred_at: Date;
      short_code: string;
      title: string | null;
      domain: string | null;
      ip: string | null;
      country_code: string | null;
      country_name: string | null;
      region: string | null;
      city: string | null;
      latitude: number | null;
      longitude: number | null;
      referer: string | null;
      user_agent: string | null;
    }>(`
      SELECT c.occurred_at,
             l.short_code,
             l.title,
             d.domain AS domain,
             c.ip::text AS ip,
             c.country_code,
             c.country_name,
             c.region,
             c.city,
             c.latitude,
             c.longitude,
             c.referer,
             c.user_agent
      FROM click_events c
      JOIN links l ON l.id = c.link_id
      LEFT JOIN domains d ON d.id = l.domain_id
      WHERE c.link_id = $1 ${rangeSql.sql} ${countrySql.sql}
      ORDER BY c.occurred_at DESC
      LIMIT $${limitIdx}
    `, countrySql.params);

    const data = rows.rows.map((r) => ({
      occurred_at: r.occurred_at?.toISOString(),
      short_code: r.short_code,
      title: r.title ?? '',
      domain: r.domain ?? '',
      ip: r.ip ?? '',
      country_code: r.country_code ?? '',
      country: r.country_name ?? '',
      region: r.region ?? '',
      city: r.city ?? '',
      latitude: r.latitude ?? '',
      longitude: r.longitude ?? '',
      referer: r.referer ?? '',
      user_agent: r.user_agent ?? '',
    }));

    const filename = `link-${shortCode}-${String(range || '7d')}.csv`;
    return sendCsv(res, filename, [
      'occurred_at',
      'short_code',
      'title',
      'domain',
      'ip',
      'country_code',
      'country',
      'region',
      'city',
      'latitude',
      'longitude',
      'referer',
      'user_agent',
    ], data);
  } catch (e) {
    log('error', 'analytics.exportLinkCsv.error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * GET /api/analytics/domains/:id/summary
 */
export async function domainSummary(req: OrgRequest, res: Response) {
  try {
    const orgId = req.org?.orgId;
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
    log('error', 'analytics.domainSummary.error', { error: String(e) });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

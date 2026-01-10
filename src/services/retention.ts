import db from '../config/database';
import { getRetentionDefaultDays } from './platformConfig';

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;

function parseDays(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function parseHours(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function runRetentionCleanup() {
  const fallbackDays = parseDays(process.env.DEFAULT_RETENTION_DAYS);
  try {
    const platformDefault = await getRetentionDefaultDays();
    const effectiveDefault = platformDefault ?? fallbackDays;

    if (!effectiveDefault) {
      const hasOrgRetention = await db.query(
        `SELECT 1 FROM orgs WHERE data_retention_days IS NOT NULL LIMIT 1`
      );
      if (!hasOrgRetention.rows.length) return;
    }

    await db.query(
      `
      DELETE FROM click_events ce
      USING links l
      JOIN orgs o ON o.id = l.org_id
      WHERE ce.link_id = l.id
        AND (
          (o.data_retention_days IS NOT NULL
            AND ce.occurred_at < NOW() - make_interval(days => o.data_retention_days))
          OR ($1::int > 0
            AND o.data_retention_days IS NULL
            AND ce.occurred_at < NOW() - make_interval(days => $1))
        )
      `,
      [effectiveDefault ?? 0]
    );
  } catch (err) {
    console.error('retention cleanup failed:', err);
  }
}

export function scheduleRetentionCleanup() {
  const hours = parseHours(process.env.RETENTION_CLEANUP_INTERVAL_HOURS);
  const interval = hours ? hours * 60 * 60 * 1000 : DEFAULT_INTERVAL_MS;
  const safeInterval = Number.isFinite(interval) && interval > 0 ? interval : DEFAULT_INTERVAL_MS;
  setTimeout(() => void runRetentionCleanup(), 60 * 1000);
  setInterval(() => void runRetentionCleanup(), safeInterval);
}

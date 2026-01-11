import db from '../config/database';
import { log } from '../utils/logger';

export async function logAudit(params: {
  org_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, any>;
}) {
  try {
    const { org_id, user_id, action, entity_type, entity_id, metadata } = params;
    await db.query(
      `INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [org_id, user_id, action, entity_type, entity_id ?? null, metadata ?? {}]
    );
  } catch (e) {
    log('warn', 'audit.log.insert.failed', { error: String(e) });
  }
}

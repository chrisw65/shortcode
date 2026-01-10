import db from '../config/database';

export async function recordConsent(params: {
  user_id: string;
  consent_type: string;
  version: string;
  metadata?: Record<string, any>;
}) {
  const { user_id, consent_type, version, metadata } = params;
  await db.query(
    `INSERT INTO user_consents (user_id, consent_type, version, metadata)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, consent_type, version) DO NOTHING`,
    [user_id, consent_type, version, metadata ?? {}]
  );
}

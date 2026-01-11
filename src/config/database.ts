// src/config/database.ts
import { Pool } from 'pg';
import { log } from '../utils/logger';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'shortlink_dev',
  user: process.env.POSTGRES_USER || 'shortlink',
  password: process.env.POSTGRES_PASSWORD || 'dev_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  log('info', 'database.connected');
});

pool.on('error', (err) => {
  log('error', 'database.error', { error: String(err) });
});

export default pool;


// src/config/redis.ts
import { createClient } from 'redis';
import { log } from '../utils/logger';

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  },
  password: process.env.REDIS_PASSWORD || undefined
});

redisClient.on('error', (err) => log('error', 'redis.error', { error: String(err) }));
redisClient.on('connect', () => log('info', 'redis.connected'));
redisClient.on('ready', () => log('info', 'redis.ready'));

// Important: Don't call connect() here, do it in index.ts
export default redisClient;

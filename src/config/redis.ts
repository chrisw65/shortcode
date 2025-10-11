// src/config/redis.ts
import { createClient } from 'redis';

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  },
  password: process.env.REDIS_PASSWORD || undefined
});

redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.on('connect', () => console.log('✓ Redis connected'));
redisClient.on('ready', () => console.log('✓ Redis ready'));

// Important: Don't call connect() here, do it in index.ts
export default redisClient;

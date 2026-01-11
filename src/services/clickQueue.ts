// src/services/clickQueue.ts
import db from '../config/database';
import redisClient from '../config/redis';
import { lookupGeo } from './geoip';

const QUEUE_KEY = 'shortlink:clicks';
let workerStarted = false;
let readyPromise: Promise<void> | null = null;

async function waitForRedisReady() {
  if (redisClient.isReady) return;
  if (!readyPromise) {
    readyPromise = new Promise((resolve) => {
      const onReady = () => {
        redisClient.off('ready', onReady);
        readyPromise = null;
        resolve();
      };
      redisClient.on('ready', onReady);
    });
  }
  await readyPromise;
}

type ClickPayload = {
  link_id: string;
  ip: string | null;
  referer: string | null;
  user_agent: string | null;
};

export async function enqueueClick(payload: ClickPayload) {
  if (!redisClient.isReady) throw new Error('Redis not ready');
  await redisClient.rPush(QUEUE_KEY, JSON.stringify(payload));
}

async function processClick(payload: ClickPayload) {
  const geo = await lookupGeo(payload.ip);
  await db.query(`UPDATE links SET click_count = COALESCE(click_count,0) + 1 WHERE id = $1`, [payload.link_id]);
  await db.query(
    `INSERT INTO click_events (link_id, ip, referer, user_agent, country_code, country_name, region, city, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      payload.link_id,
      payload.ip,
      payload.referer,
      payload.user_agent,
      geo?.country_code ?? null,
      geo?.country_name ?? null,
      geo?.region ?? null,
      geo?.city ?? null,
      geo?.latitude ?? null,
      geo?.longitude ?? null,
    ]
  );
}

export function startClickWorker() {
  if (workerStarted) return;
  workerStarted = true;
  const loop = async () => {
    while (workerStarted) {
      try {
        await waitForRedisReady();
        const item = await redisClient.brPop(QUEUE_KEY, 5);
        if (!item?.element) continue;
        const payload = JSON.parse(item.element) as ClickPayload;
        await processClick(payload);
      } catch (err) {
        console.error('clickQueue worker error:', err);
        if (!redisClient.isReady) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
  };
  void loop();
}

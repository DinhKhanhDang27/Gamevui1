import { createClient } from 'redis';

const getRedisUrl = () => process.env.KV_URL || process.env.REDIS_URL;

export const getRedis = async () => {
  if (globalThis.__redisClient) return globalThis.__redisClient;

  const url = getRedisUrl();
  if (!url) {
    throw new Error('Missing KV_URL');
  }

  const client = createClient({ url });
  client.on('error', (err) => {
    console.error('Redis error', err);
  });

  await client.connect();
  globalThis.__redisClient = client;
  return client;
};

import { Redis } from 'ioredis';

const url = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });

export async function cached(key, ttlSeconds, producer) {
  try {
    if (redis.status === 'wait') await redis.connect();
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit);
    const value = await producer();
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return value;
  } catch {
    return producer();
  }
}

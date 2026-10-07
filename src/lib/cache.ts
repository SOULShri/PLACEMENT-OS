import { redisConnection } from './queues/queue-manager';
import { logger } from './logger';

const DEFAULT_TTL = 15 * 60; // 15 minutes default

export const cacheManager = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redisConnection.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error(`Cache get failed for key: ${key}`, error);
      return null;
    }
  },

  async set<T>(key: string, value: T, ttlSeconds = DEFAULT_TTL): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await redisConnection.setex(key, ttlSeconds, serializedValue);
    } catch (error) {
      logger.error(`Cache set failed for key: ${key}`, error);
    }
  },

  async delete(key: string): Promise<void> {
    try {
      await redisConnection.del(key);
      logger.info(`Cache invalidated for key: ${key}`);
    } catch (error) {
      logger.error(`Cache delete failed for key: ${key}`, error);
    }
  },

  // Invalidate cache keys matching pattern e.g. "company:*"
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redisConnection.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redisConnection.del(...keys);
          logger.info(`Invalidated matching cache keys: ${keys.join(', ')}`);
        }
      } while (cursor !== '0');
    } catch (error) {
      logger.error(`Cache invalidatePattern failed for pattern: ${pattern}`, error);
    }
  }
};
